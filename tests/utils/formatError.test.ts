import { describe, expect, it } from "vitest";

import { formatUnknownError } from "../../src/utils/formatError.js";

describe("formatUnknownError", () => {
  it("returns Error message", () => {
    expect(formatUnknownError(new Error("boom"))).toBe("boom");
  });

  it("extracts message from Kite-style error objects", () => {
    expect(
      formatUnknownError({
        status: 429,
        error_type: "TooManyRequests",
        message: "Rate limit exceeded",
      }),
    ).toBe("TooManyRequests: Rate limit exceeded");
  });

  it("returns plain strings unchanged", () => {
    expect(formatUnknownError("already readable")).toBe("already readable");
  });
});
