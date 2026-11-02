import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOperationFeedback } from "../logic/useOperationFeedback";
import { usePortal } from "../logic/usePortal";
import { useProjectDetail } from "../logic/useProjectDetail";
import { useProjects } from "../logic/useProjects";
import { clientsApi } from "../services/api/clients";
import { projectsApi } from "../services/api/projects";
import type { Detail, User } from "../types/portal";
import { splitApiMock } from "./splitApiFixture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

function detail(name: string): Detail {
  return {
    project: { id: "p1", name, milestones: [] },
    files: [],
    folders: [],
    updates: [],
  } as unknown as Detail;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("portal state ownership", () => {
  it("keeps a new client selection safe from old refresh callbacks and responses", async () => {
    const oldResponse = deferred<Awaited<ReturnType<typeof projectsApi.list>>>();
    const newResponse = deferred<Awaited<ReturnType<typeof projectsApi.list>>>();
    vi.spyOn(clientsApi, "list").mockResolvedValue([]);
    vi.spyOn(projectsApi, "list")
      .mockResolvedValueOnce([detail("Initial").project])
      .mockImplementationOnce(() => oldResponse.promise)
      .mockImplementationOnce(() => newResponse.promise);
    const reportError = vi.fn();
    const { result } = renderHook(() => useProjects("owner", true, reportError));
    await waitFor(() => expect(result.current.selectedId).toBe("p1"));
    const staleRefresh = result.current.refresh;
    let older!: Promise<void>;
    act(() => {
      older = staleRefresh();
    });
    act(() => result.current.selectClient("another-client"));
    await waitFor(() => expect(projectsApi.list).toHaveBeenCalledWith("another-client"));
    await act(async () => {
      await staleRefresh();
    });
    expect(projectsApi.list).toHaveBeenCalledTimes(3);
    await act(async () => {
      newResponse.resolve([{ ...detail("New selection").project, id: "p2" }]);
    });
    await waitFor(() => expect(result.current.selectedId).toBe("p2"));
    await act(async () => {
      oldResponse.reject(new Error("Old request failed"));
      await older;
    });
    expect(result.current.selectedClientId).toBe("another-client");
    expect(result.current.items[0].name).toBe("New selection");
    expect(reportError).not.toHaveBeenCalled();
  });
  it("keeps the newest project refresh and hides data when the session changes", async () => {
    vi.spyOn(projectsApi, "detail").mockResolvedValue(detail("Initial"));
    const { result, rerender } = renderHook(({ userId }) => useProjectDetail(userId, "p1"), {
      initialProps: { userId: "owner" },
    });
    await waitFor(() => expect(result.current.detail?.project.name).toBe("Initial"));
    const older = deferred<Detail>();
    const newer = deferred<Detail>();
    vi.mocked(projectsApi.detail)
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.refresh();
      second = result.current.refresh();
    });
    await act(async () => {
      newer.resolve(detail("Newest"));
      await second;
    });
    await act(async () => {
      older.resolve(detail("Old"));
      await first;
    });
    expect(result.current.detail?.project.name).toBe("Newest");
    vi.mocked(projectsApi.detail).mockImplementation(() => new Promise(() => {}));
    rerender({ userId: "another-account" });
    expect(result.current.detail).toBeNull();
  });

  it("tracks overlapping operations and ignores completion after feedback reset", async () => {
    const { result } = renderHook(useOperationFeedback);
    const first = deferred<void>();
    const second = deferred<void>();
    const afterSuccess = vi.fn();
    let firstRun!: Promise<void>;
    let secondRun!: Promise<void>;
    act(() => {
      firstRun = result.current.run(() => first.promise);
      secondRun = result.current.run(() => second.promise, { onSuccess: afterSuccess });
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      first.resolve();
      await firstRun;
    });
    expect(result.current.busy).toBe(true);
    act(() => result.current.reset());
    await act(async () => {
      second.reject(new Error("Late failure"));
      await secondRun;
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBe("");
    expect(result.current.notice).toBe("");
    expect(afterSuccess).not.toHaveBeenCalled();
  });

  it("refreshes account data without refreshing projects and clears every owner on logout", async () => {
    const paths: string[] = [];
    const user = { id: "owner", displayName: "Owner", roles: ["Owner"], hasPassword: true };
    const client: User = {
      id: "client",
      displayName: "Client",
      roles: ["Client"],
      hasPassword: false,
      email: null,
      phoneNumber: null,
    };
    vi.stubGlobal(
      "fetch",
      splitApiMock(
        vi.fn(async (path: string) => {
          paths.push(path);
          const data = path.endsWith("setup-status")
            ? { required: false }
            : path.endsWith("/me")
              ? user
              : path.endsWith("/admin/users")
                ? [client]
                : path.endsWith("/activation")
                  ? { url: "https://example.test/#activation=one-use" }
                  : path.endsWith("/clients")
                    ? []
                    : path.endsWith("/p1")
                      ? detail("Project")
                      : path.startsWith("/api/projects")
                        ? [detail("Project").project]
                        : undefined;

          return new Response(data === undefined ? "" : JSON.stringify(data));
        }),
      ),
    );
    const { result } = renderHook(usePortal);
    await waitFor(() => expect(result.current.project.data?.name).toBe("Project"));
    act(() => result.current.navigation.go("users"));
    await waitFor(() => expect(result.current.people.items).toHaveLength(1));
    paths.length = 0;
    await act(async () => result.current.people.generateLink(client));
    expect(paths).toEqual(["/api/admin/users/client/activation", "/api/admin/users"]);
    expect(result.current.people.accessLink).toContain("activation=");
    expect(result.current.navigation.modal).toBe("link");
    paths.length = 0;
    await act(async () => result.current.people.disableUser(client));
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/admin/users/client/disabled",
        "/api/admin/users",
        "/api/clients",
      ]),
    );
    expect(paths).not.toContain("/api/projects/p1");
    expect(paths.some((path) => /^\/api\/projects(?:\?|$)/.test(path))).toBe(false);
    act(() => {
      result.current.navigation.setSearch("old search");
      result.current.navigation.setActiveFolder("old folder");
    });
    paths.length = 0;
    await act(async () => result.current.session.logout());
    expect(paths).toEqual(["/api/auth/logout"]);
    expect(result.current.session.user).toBeNull();
    expect(result.current.projects.items).toEqual([]);
    expect(result.current.projects.selectedId).toBe("");
    expect(result.current.project.detail).toBeNull();
    expect(result.current.people.items).toEqual([]);
    expect(result.current.people.accessLink).toBe("");
    expect(result.current.navigation.page).toBe("dashboard");
    expect(result.current.navigation.modal).toBe("");
    expect(result.current.navigation.search).toBe("");
    expect(result.current.navigation.activeFolder).toBeNull();
    expect(result.current.feedback.error).toBe("");
    expect(result.current.feedback.busy).toBe(false);
  });
});
