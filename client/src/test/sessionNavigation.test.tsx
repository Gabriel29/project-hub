import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useOperationFeedback } from "../logic/useOperationFeedback";
import { useSession } from "../logic/useSession";
import { authApi } from "../services/api/auth";
import type { User } from "../types/portal";

beforeEach(() => {
  history.replaceState(null, "", "/");
  vi.spyOn(authApi, "status").mockResolvedValue({ required: false });
  vi.spyOn(authApi, "me").mockRejectedValue(new Error("Signed out"));
});
afterEach(() => {
  vi.restoreAllMocks();
  history.replaceState(null, "", "/");
});
const useTestSession = () => useSession(useOperationFeedback());

function navigate(fragment: string, event = "hashchange") {
  act(() => {
    history.replaceState(null, "", `/#${fragment}`);
    window.dispatchEvent(new Event(event));
  });
}

it("accepts a reset link in the mounted app after logout and submits its token", async () => {
  vi.mocked(authApi.me).mockResolvedValueOnce({
    id: "owner",
    roles: ["Owner"],
    language: "en",
  } as User);
  vi.spyOn(authApi, "logout").mockResolvedValue(undefined);
  const submit = vi.spyOn(authApi, "submit").mockResolvedValue(undefined);
  const { result } = renderHook(useTestSession);
  await waitFor(() => expect(result.current.user?.id).toBe("owner"));
  await act(async () => result.current.signOut());
  navigate("reset=after-logout-token");
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.entry).toMatchObject({ purpose: "reset", token: "after-logout-token" });
  expect(location.hash).toBe("");
  await act(async () => result.current.submitLogin({ password: "updated1" }));
  expect(submit).toHaveBeenCalledWith("/auth/reset", {
    token: "after-logout-token",
    password: "updated1",
  });
  expect(result.current.user).toBeNull();
  await waitFor(() => expect(result.current.entry.purpose).toBe(""));
});

it("handles activation navigation and a replacement link through browser history", async () => {
  const activation = vi
    .spyOn(authApi, "activation")
    .mockResolvedValue({ name: "Contact", email: "client@example.test", phoneNumber: null });
  const { result } = renderHook(useTestSession);
  await waitFor(() => expect(result.current.loading).toBe(false));
  navigate("activation=invite-token");
  await waitFor(() => expect(result.current.activationDetails?.name).toBe("Contact"));
  expect(activation).toHaveBeenCalledWith("invite-token");
  navigate("reset=replacement-token", "popstate");
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.entry).toMatchObject({ purpose: "reset", token: "replacement-token" });
  expect(result.current.activationDetails).toBeNull();
  expect(location.hash).toBe("");
});

it("does not discard a new link when an older submission finishes", async () => {
  let complete!: () => void;
  vi.spyOn(authApi, "submit").mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  const { result } = renderHook(useTestSession);
  await waitFor(() => expect(result.current.loading).toBe(false));
  navigate("reset=old-token");
  await waitFor(() => expect(result.current.loading).toBe(false));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.submitLogin({ password: "updated1" });
  });
  navigate("reset=new-token");
  await waitFor(() => expect(result.current.entry.token).toBe("new-token"));
  await act(async () => {
    complete();
    await pending;
  });
  expect(result.current.entry).toMatchObject({ purpose: "reset", token: "new-token" });
});

it("keeps an in-flight recovery when the same link is opened again", async () => {
  let complete!: () => void;
  vi.spyOn(authApi, "submit").mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  const { result } = renderHook(useTestSession);
  await waitFor(() => expect(result.current.loading).toBe(false));
  navigate("reset=same-token");
  await waitFor(() => expect(result.current.loading).toBe(false));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.submitLogin({ password: "updated1" });
  });
  navigate("reset=same-token");
  await act(async () => {
    complete();
    await pending;
  });
  await waitFor(() => expect(result.current.entry.purpose).toBe(""));
  expect(result.current.loading).toBe(false);
});
