import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { CreateUser } from "../components/CreateUser";
import { setLanguage } from "../i18n";

it("starts with person type and invites admins without a password or client label", async () => {
  setLanguage("en");
  const submit = vi.fn();
  const events = userEvent.setup();
  const { container } = render(<CreateUser owner busy={false} onSubmit={submit} />);
  const type = screen.getByRole("combobox");
  expect(container.querySelector("form input, form select")).toBe(type);
  await events.selectOptions(type, "admin");
  expect(container.querySelector('input[name="clientName"]')).toBeDisabled();
  expect(container.querySelector('input[type="password"]')).toBeNull();
  await events.type(screen.getByLabelText("Full name"), "Invited admin");
  await events.type(screen.getByLabelText("Email"), "admin@example.test");
  await events.click(screen.getByRole("button", { name: "Create account" }));
  expect(submit).toHaveBeenCalledWith({
    admin: true,
    name: "Invited admin",
    email: "admin@example.test",
    phoneNumber: "",
  });
});
