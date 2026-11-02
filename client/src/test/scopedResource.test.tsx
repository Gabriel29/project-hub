import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { useScopedResource } from "../logic/useScopedResource";

it("hides previous locations immediately and ignores late folder and session responses", async () => {
  let oldResolve!: (value: string) => void;
  const oldLoad = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        oldResolve = resolve;
      }),
  );
  const nextLoad = vi.fn(async () => "second folder");
  const { result, rerender } = renderHook(({ scope, load }) => useScopedResource(scope, load), {
    initialProps: { scope: "owner/project/first", load: oldLoad },
  });
  await waitFor(() => expect(oldLoad).toHaveBeenCalled());
  rerender({ scope: "owner/project/second", load: nextLoad });
  expect(result.current.value).toBeNull();
  await waitFor(() => expect(result.current.value).toBe("second folder"));
  await act(async () => oldResolve("stale first folder"));
  expect(result.current.value).toBe("second folder");
  rerender({ scope: "client/project/second", load: oldLoad });
  expect(result.current.value).toBeNull();
});

it("clears previously loaded content after access fails and supports retry", async () => {
  const load = vi.fn<() => Promise<string>>().mockResolvedValue("allowed");
  const { result } = renderHook(() => useScopedResource("owner/project/folder", load));
  await waitFor(() => expect(result.current.value).toBe("allowed"));
  load.mockRejectedValueOnce(new Error("Access changed"));
  await act(async () => {
    await expect(result.current.refresh()).rejects.toThrow("Access changed");
  });
  expect(result.current.value).toBeNull();
  expect(result.current.error).toBe("Access changed");
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.value).toBe("allowed");
});
