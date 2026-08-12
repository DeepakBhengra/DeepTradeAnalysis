import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("samcoStaticIp", () => {
  const originalRequired = process.env.SAMCO_REQUIRED_STATIC_IP;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.SAMCO_REQUIRED_STATIC_IP;
  });

  afterEach(() => {
    if (originalRequired === undefined) {
      delete process.env.SAMCO_REQUIRED_STATIC_IP;
    } else {
      process.env.SAMCO_REQUIRED_STATIC_IP = originalRequired;
    }
  });

  it("defaults required static IP to 223.181.63.52", async () => {
    const { getSamcoRequiredStaticIp, DEFAULT_SAMCO_REQUIRED_STATIC_IP } =
      await import("../../src/samco/samcoStaticIp.js");
    expect(DEFAULT_SAMCO_REQUIRED_STATIC_IP).toBe("223.181.63.52");
    expect(getSamcoRequiredStaticIp()).toBe("223.181.63.52");
  });

  it("allows disabling the check with an empty env value", async () => {
    process.env.SAMCO_REQUIRED_STATIC_IP = "";
    const { getSamcoRequiredStaticIp, isSamcoStaticIpEnforced, doesSamcoStaticIpMatch } =
      await import("../../src/samco/samcoStaticIp.js");
    expect(getSamcoRequiredStaticIp()).toBe("");
    expect(isSamcoStaticIpEnforced()).toBe(false);
    expect(doesSamcoStaticIpMatch("1.2.3.4")).toBe(true);
  });

  it("matches only the exact required IP", async () => {
    process.env.SAMCO_REQUIRED_STATIC_IP = "223.181.63.52";
    const { doesSamcoStaticIpMatch, formatSamcoStaticIpMismatch } = await import(
      "../../src/samco/samcoStaticIp.js"
    );
    expect(doesSamcoStaticIpMatch("223.181.63.52")).toBe(true);
    expect(doesSamcoStaticIpMatch("52.40.244.0")).toBe(false);
    expect(formatSamcoStaticIpMismatch("52.40.244.0")).toContain("223.181.63.52");
  });

  it("blocks live placeOrder when whoami IP does not match", async () => {
    process.env.SAMCO_REQUIRED_STATIC_IP = "223.181.63.52";
    process.env.SAMCO_API_KEY = "key";
    process.env.SAMCO_API_SECRET = "secret";
    process.env.SAMCO_SESSION_TOKEN = "session-token";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/ip/whoami")) {
        return new Response(
          JSON.stringify({ status: "Success", srcIp: "52.40.244.0" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ status: "Success" }), { status: 200 });
    });

    const { setSamcoFetch, placeSamcoOrder } = await import(
      "../../src/samco/samcoClient.js"
    );
    setSamcoFetch(fetchMock as typeof fetch);

    await expect(
      placeSamcoOrder({
        symbolName: "ASIANPAINT",
        exchange: "NSE",
        transactionType: "BUY",
        orderType: "L",
        quantity: "10",
        orderValidity: "DAY",
        productType: "MIS",
        afterMarketOrderFlag: "NO",
        price: "2734.45",
      }),
    ).rejects.toThrow(/223\.181\.63\.52/);

    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/order/placeOrder")),
    ).toBe(false);
  });
});
