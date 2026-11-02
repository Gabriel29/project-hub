import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { ProjectSearch } from "../components/ProjectSearch";

afterEach(() => vi.unstubAllGlobals());
it("shows backend suggestions, selects a project and closes on Escape", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            { kind: "project", id: "p2", name: "Vila Two", code: "VL-1002", clientId: "c2" },
            { kind: "client", id: "c2", name: "Vlad", code: "VL", clientId: "c2" },
          ]),
        ),
    ),
  );
  const select = vi.fn();
  const user = userEvent.setup();
  render(<ProjectSearch select={select} />);
  const input = screen.getByLabelText("Caută client sau cod");
  await user.type(input, "Vila");
  await user.click(await screen.findByRole("button", { name: /Vila Two/ }));
  expect(select).toHaveBeenCalledWith(
    expect.objectContaining({ id: "p2", clientId: "c2", kind: "project" }),
  );
  expect(input).toHaveValue("");
  await user.click(input);
  await user.keyboard("{Escape}");
  expect(input).toHaveAttribute("aria-expanded", "false");
});
it("ignores a stale response when the search changes", async () => {
  let resolveOld!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.includes("query=old")
        ? new Promise<Response>((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve(new Response("[]")),
    ),
  );
  const user = userEvent.setup();
  render(<ProjectSearch select={vi.fn()} />);
  const input = screen.getByLabelText("Caută client sau cod");
  await user.type(input, "old");
  await waitFor(() => expect(resolveOld).toBeDefined());
  await user.clear(input);
  await user.type(input, "new");
  await screen.findByText("Niciun rezultat.");
  resolveOld(
    new Response(
      JSON.stringify([
        { kind: "project", id: "old", name: "Stale project", code: "OLD", clientId: null },
      ]),
    ),
  );
  await waitFor(() => expect(screen.queryByText("Stale project")).not.toBeInTheDocument());
});
