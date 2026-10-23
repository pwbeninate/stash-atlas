import { describe, expect, it } from "vitest";
import { niceTicks } from "./scale";

describe("niceTicks", () => {
  it("picks round steps that cover the max", () => {
    expect(niceTicks(212_400)).toEqual([0, 100_000, 200_000, 300_000]);
    expect(niceTicks(180_000)).toEqual([0, 50_000, 100_000, 150_000, 200_000]);
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0.3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it("handles zero and invalid input", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(Number.NaN)).toEqual([0, 1]);
  });
});
