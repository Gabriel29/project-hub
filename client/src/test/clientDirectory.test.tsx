import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useProjects } from "../logic/useProjects";
import { clientsApi } from "../services/api/clients";
import { projectsApi } from "../services/api/projects";

afterEach(() => vi.restoreAllMocks());

it("loads client projects directly and never requests the management directory", async () => {
  const directory = vi.spyOn(clientsApi, "list").mockResolvedValue([]);
  const projects = vi.spyOn(projectsApi, "list").mockResolvedValue([]);
  const report = vi.fn();
  const { result } = renderHook(() => useProjects("client", false, report));
  await waitFor(() => expect(projects).toHaveBeenCalledWith(""));
  await act(async () => {
    await result.current.refreshClients();
  });
  expect(directory).not.toHaveBeenCalled();
  expect(result.current.clients).toEqual([]);
  expect(report).not.toHaveBeenCalled();
});

it("hides directory data immediately and ignores late responses when management access changes", async () => {
  let finish!: (value: Awaited<ReturnType<typeof clientsApi.list>>) => void;
  const directory = vi.spyOn(clientsApi, "list").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  vi.spyOn(projectsApi, "list").mockResolvedValue([]);
  const report = vi.fn();
  const { result, rerender } = renderHook(
    ({ manager }) => useProjects("same-user", manager, report),
    { initialProps: { manager: true } },
  );
  await waitFor(() => expect(directory).toHaveBeenCalledTimes(1));
  const staleRefresh = result.current.refreshClients;
  rerender({ manager: false });
  expect(result.current.clients).toEqual([]);
  await act(async () => {
    finish([
      {
        id: "internal",
        displayName: "Internal label",
        email: "private@example.test",
        code: "PRIVATE",
      },
    ]);
    await staleRefresh();
  });
  expect(result.current.clients).toEqual([]);
  expect(directory).toHaveBeenCalledTimes(1);
  expect(report).not.toHaveBeenCalled();
});
