import { describe, expect, it } from "vitest";
import {
  formatSamcoLimitPrice,
  resolveSamcoPlaceOrderType,
} from "../../src/samco/samcoOrderType.js";
import {
  SamcoApiError,
  formatSamcoApiErrorMessage,
} from "../../src/samco/samcoClient.js";

describe("resolveSamcoPlaceOrderType", () => {
  it("maps market and unknown types to limit", () => {
    expect(resolveSamcoPlaceOrderType("MKT")).toBe("L");
    expect(resolveSamcoPlaceOrderType("MARKET")).toBe("L");
    expect(resolveSamcoPlaceOrderType("")).toBe("L");
    expect(resolveSamcoPlaceOrderType("L")).toBe("L");
  });

  it("keeps stop-limit aliases as SL", () => {
    expect(resolveSamcoPlaceOrderType("SL")).toBe("SL");
    expect(resolveSamcoPlaceOrderType("stoploss")).toBe("SL");
  });
});

describe("formatSamcoLimitPrice", () => {
  it("formats to two decimals", () => {
    expect(formatSamcoLimitPrice(2734.45)).toBe("2734.45");
    expect(formatSamcoLimitPrice(100)).toBe("100.00");
  });
});

describe("formatSamcoApiErrorMessage", () => {
  it("prefers statusMessage and rejectionReason over bare status code", () => {
    expect(
      formatSamcoApiErrorMessage(400, {
        status: "Failure",
        statusMessage: "Invalid order type",
        rejectionReason: "orderType must be L or SL",
      }),
    ).toBe("Invalid order type — orderType must be L or SL");
  });

  it("falls back to JSON body when message fields are missing", () => {
    expect(formatSamcoApiErrorMessage(400, { status: "Failure" })).toBe(
      'Samco API error (400): {"status":"Failure"}',
    );
  });

  it("SamcoApiError uses the formatted message", () => {
    const error = new SamcoApiError(400, {
      statusMessage: "Bad request",
    });
    expect(error.message).toBe("Bad request");
    expect(error.statusCode).toBe(400);
  });
});
