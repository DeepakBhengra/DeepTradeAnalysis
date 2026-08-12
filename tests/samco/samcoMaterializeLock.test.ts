import { describe, expect, it } from "vitest";
import {
  resetSamcoMaterializeLock,
  withSamcoMaterializeLock,
} from "../../src/samco/samcoMaterializeLock.js";

describe("withSamcoMaterializeLock", () => {
  it("runs overlapping critical sections sequentially", async () => {
    resetSamcoMaterializeLock();
    const order: number[] = [];

    const first = withSamcoMaterializeLock(async () => {
      order.push(1);
      await new Promise((resolve) => setTimeout(resolve, 30));
      order.push(2);
      return "a";
    });
    const second = withSamcoMaterializeLock(async () => {
      order.push(3);
      return "b";
    });

    await expect(Promise.all([first, second])).resolves.toEqual(["a", "b"]);
    expect(order).toEqual([1, 2, 3]);
  });
});
