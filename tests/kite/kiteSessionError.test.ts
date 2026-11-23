import { describe, expect, it } from "vitest";
import {
  KITE_TOKEN_REJECTED_ERROR,
  describeKiteSessionError,
  httpStatusForKiteFailure,
  isKiteAuthError,
} from "../../src/kite/kiteSessionError.js";

describe("kiteSessionError", () => {
  it("treats TokenException as an auth error", () => {
    const error = {
      status: 403,
      error_type: "TokenException",
      message: "Incorrect `api_key` or `access_token`.",
    };

    expect(isKiteAuthError(error)).toBe(true);
    expect(describeKiteSessionError(error)).toBe(KITE_TOKEN_REJECTED_ERROR);
    expect(httpStatusForKiteFailure(error, "token")).toBe(400);
    expect(httpStatusForKiteFailure(error, "data")).toBe(401);
  });

  it("maps wrapped expired-token errors to 401 for dashboard reads", () => {
    const error = new Error(
      "Kite access_token expired or invalid. Generate a new token and update KITE_ACCESS_TOKEN in .env.",
    );

    expect(httpStatusForKiteFailure(error, "data")).toBe(401);
    expect(httpStatusForKiteFailure(error, "token")).toBe(400);
  });

  it("keeps unexpected failures as 500", () => {
    expect(httpStatusForKiteFailure(new Error("ECONNRESET"), "data")).toBe(500);
    expect(describeKiteSessionError(new Error("socket hang up"))).toBe(
      "socket hang up",
    );
  });
});
