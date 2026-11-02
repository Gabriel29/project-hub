import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { setLanguage } from "../i18n";
import { TeamPage } from "../pages/TeamPage";
import type { User } from "../types/portal";

const person = (id: string, roles: string[], extra: Partial<User> = {}): User => ({
  id,
  roles,
  displayName: id,
  email: `${id}@example.test`,
  phoneNumber: null,
  hasPassword: true,
  ...extra,
});
const owner = person("Owner One", ["Owner"]);
const admin = person("Admin Two", ["Admin"]);
const active = person("Ștefan Popescu", ["Client"], {
  activeLinkExpiresAt: "2099-01-01T00:00:00Z",
  clientName: "Vila Nord",
  phoneNumber: "0722123456",
});
const pending = person("Pending Client", ["Client"], { hasPassword: false });
const disabled = person("Disabled Client", ["Client"], { disabled: true });

function setup(overrides: Partial<ComponentProps<typeof TeamPage>> = {}) {
  setLanguage("en");
  const props: ComponentProps<typeof TeamPage> = {
    user: owner,
    people: [owner, admin, active, pending, disabled],
    peopleLoading: false,
    busy: false,
    setModal: vi.fn(),
    generateLink: vi.fn(),
    disableUser: vi.fn(),
    revokeUser: vi.fn(),
    ...overrides,
  };
  render(<TeamPage {...props} />);

  return { ...props, events: userEvent.setup() };
}

function row(name: string) {
  return within(screen.getByText(name, { selector: "strong" }).closest("li")!);
}

describe("people directory", () => {
  it("combines accent-insensitive contact search, role, and status filters and can reset them", async () => {
    const { events } = setup();
    const search = screen.getByRole("searchbox", { name: "Search people" });
    await events.type(search, "stefan");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(row(active.displayName).getByText("Vila Nord")).toBeVisible();
    await events.clear(search);
    await events.type(search, "0722123");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    await events.clear(search);
    await events.selectOptions(screen.getByRole("combobox", { name: "Filter by role" }), "Client");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    await events.click(screen.getByRole("button", { name: "Pending activation" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(
      row(pending.displayName).getByRole("button", { name: "Generate activation link" }),
    ).toBeEnabled();
    await events.type(search, "no-match");
    expect(screen.getByText("No matching people")).toBeVisible();
    await events.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("keeps owner and admin peer management protected while allowing client management", async () => {
    const { events, disableUser, revokeUser, generateLink } = setup({ user: admin });
    expect(row(owner.displayName).queryByRole("button")).not.toBeInTheDocument();
    expect(row(admin.displayName).queryByRole("button")).not.toBeInTheDocument();
    await events.click(row(active.displayName).getByRole("button", { name: "Reset password" }));
    expect(generateLink).toHaveBeenCalledWith(active);
    await events.click(row(active.displayName).getByLabelText(`Menu ${active.displayName}`));
    await events.click(row(active.displayName).getByRole("button", { name: "Revoke links" }));
    expect(revokeUser).toHaveBeenCalledWith(active);
    await events.click(row(active.displayName).getByLabelText(`Menu ${active.displayName}`));
    await events.click(row(active.displayName).getByRole("button", { name: "Deactivate" }));
    expect(disableUser).toHaveBeenCalledWith(active);
    expect(
      row(disabled.displayName).queryByRole("button", { name: "Reset password" }),
    ).not.toBeInTheDocument();
    await events.click(row(disabled.displayName).getByLabelText(`Menu ${disabled.displayName}`));
    expect(row(disabled.displayName).getByRole("button", { name: "Activate" })).toBeEnabled();
    expect(
      row(disabled.displayName).queryByRole("button", { name: "Revoke links" }),
    ).not.toBeInTheDocument();
  });

  it("allows the owner to manage admins and disables mutations during requests", async () => {
    const { events } = setup({ busy: true });
    await events.click(row(admin.displayName).getByLabelText(`Menu ${admin.displayName}`));
    expect(row(admin.displayName).getByRole("button", { name: "Deactivate" })).toBeDisabled();
    expect(row(active.displayName).getByRole("button", { name: "Reset password" })).toBeDisabled();
  });

  it("shows loading before the empty directory", () => {
    setup({ people: [], peopleLoading: true });
    expect(screen.getByRole("status")).toHaveTextContent("Loading people…");
    expect(screen.queryByText("Your directory starts here")).not.toBeInTheDocument();
  });
});

it("hides revoke for missing and expired links", async () => {
  const { events } = setup({
    people: [
      { ...pending, activeLinkExpiresAt: null },
      { ...active, activeLinkExpiresAt: "2000-01-01T00:00:00Z" },
    ],
  });
  for (const p of [pending, active]) {
    await events.click(row(p.displayName).getByLabelText(`Menu ${p.displayName}`));
    expect(
      row(p.displayName).queryByRole("button", { name: "Revoke links" }),
    ).not.toBeInTheDocument();
  }
});

it("offers activation and recovery for admins only to the owner", async () => {
  const invited = { ...admin, hasPassword: false, activeLinkExpiresAt: "2099-01-01T00:00:00Z" };
  const { events, generateLink, revokeUser } = setup({ people: [invited] });
  await events.click(
    row(admin.displayName).getByRole("button", { name: "Generate activation link" }),
  );
  expect(generateLink).toHaveBeenCalledWith(invited);
  expect(row(admin.displayName).getByText("Pending activation")).toBeVisible();
  await events.click(row(admin.displayName).getByLabelText(`Menu ${admin.displayName}`));
  await events.click(row(admin.displayName).getByRole("button", { name: "Revoke links" }));
  expect(revokeUser).toHaveBeenCalledWith(invited);
});
