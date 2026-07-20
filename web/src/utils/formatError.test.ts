import { describe, expect, it } from "vitest";

import { formatNetworkFetchError, formatUnknownError, readApiErrorBody } from "./formatError";

describe("formatUnknownError", () => {
  it("reads nested API error bodies", () => {
    expect(readApiErrorBody({ error: "Server down" }, "fallback")).toBe("Server down");
    expect(readApiErrorBody({ error: { message: "Bad request" } }, "fallback")).toBe(
      "Bad request",
    );
    expect(readApiErrorBody(null, "fallback")).toBe("fallback");
  });

  it("formats plain objects without message as JSON", () => {
    expect(formatUnknownError({ code: 123 })).toBe('{"code":123}');
  });
});

describe("formatNetworkFetchError", () => {
  it("maps browser Failed to fetch to actionable API server message", () => {
    const message = formatNetworkFetchError(new Error("Failed to fetch"), "day scan");
    expect(message).toContain("Cannot connect to the API server");
    expect(message).toContain("npm run dev:dashboard");
    expect(message).toContain("localhost:5173");
  });
});
