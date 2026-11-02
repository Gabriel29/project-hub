import { afterEach, expect, test, vi } from "vitest";

import { setLanguage, t } from "../i18n";
import { api } from "../services/api/http";

afterEach(() => vi.unstubAllGlobals());

test("localizes stable problem codes before server detail text", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 403,
          title: "Forbidden",
          detail: "Server text can change without changing localization",
          code: "accessDenied",
          traceId: "test-trace",
        }),
        { status: 403, headers: { "Content-Type": "application/problem+json" } },
      ),
    ),
  );

  await expect(api("/projects")).rejects.toThrow(t("errors.accessDenied"));
});

test("accepts legacy errors and unknown problem details during rollout", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Acces interzis." }), { status: 403 }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Specific failure", code: "futureCode" }), {
        status: 409,
      }),
    );
  vi.stubGlobal("fetch", fetch);

  await expect(api("/projects")).rejects.toThrow(t("errors.accessDenied"));
  await expect(api("/projects")).rejects.toThrow("Specific failure");
});

test("preserves field errors instead of a generic invalid-request message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "invalidRequest",
          detail: "Invalid request.",
          errors: { email: ["Email invalid."] },
        }),
        { status: 400 },
      ),
    ),
  );

  await expect(api("/auth/profile")).rejects.toThrow(t("errors.invalidEmail"));
});

test("localizes standard rate-limit codes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "rateLimited",
          title: "Too Many Requests",
        }),
        { status: 429 },
      ),
    ),
  );

  await expect(api("/auth/login")).rejects.toThrow(t("errors.rateLimited"));
});

test.each(["en", "ro"] as const)(
  "sends the selected %s language to the backend",
  async (selected) => {
    setLanguage(selected);
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await api("/projects");
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({
        headers: expect.objectContaining({ "Accept-Language": selected }),
      }),
    );
  },
);
