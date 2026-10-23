import { describe, expect, it } from "vitest";
import {
  bpsToInput,
  centsToInput,
  formatBps,
  formatCents,
  largestRemainder,
  parseDollarsToCents,
  parsePercentToBps,
  ratio,
  roundedPercents,
} from "./money";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("largestRemainder", () => {
  it("splits evenly divisible totals exactly", () => {
    expect(largestRemainder(10000, [6000, 4000])).toEqual([6000, 4000]);
  });

  it("always sums to the total", () => {
    expect(largestRemainder(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(largestRemainder(1, [3333, 3333, 3334])).toEqual([0, 0, 1]);
    const parts = largestRemainder(9_999_999, [3333, 3333, 3334]);
    expect(sum(parts)).toBe(9_999_999);
  });

  it("gives leftovers to the largest remainders, ties to the earliest index", () => {
    // 10 * [1,2] / 3 = [3.33, 6.67] → [3, 7]
    expect(largestRemainder(10, [1, 2])).toEqual([3, 7]);
    expect(largestRemainder(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it("returns zeros for a zero total or all-zero weights", () => {
    expect(largestRemainder(0, [5000, 5000])).toEqual([0, 0]);
    expect(largestRemainder(100, [0, 0])).toEqual([0, 0]);
    expect(largestRemainder(100, [])).toEqual([]);
  });

  it("stays exact for very large balances", () => {
    const total = 10_000_000_000_000; // $100B in cents
    const parts = largestRemainder(total, [3333, 3333, 3334]);
    expect(sum(parts)).toBe(total);
    expect(parts[2]).toBe(3_334_000_000_000);
  });

  it("rejects negative or fractional input", () => {
    expect(() => largestRemainder(-1, [1])).toThrow(RangeError);
    expect(() => largestRemainder(1.5, [1])).toThrow(RangeError);
    expect(() => largestRemainder(1, [-1])).toThrow(RangeError);
  });
});

describe("roundedPercents", () => {
  it("adds up to exactly 100 at the given precision", () => {
    expect(roundedPercents([1, 1, 1])).toEqual([33.4, 33.3, 33.3]);
    expect(roundedPercents([1, 1, 1], 0)).toEqual([34, 33, 33]);
    expect(sum(roundedPercents([7, 13, 29, 51, 3]))).toBeCloseTo(100, 10);
  });

  it("is all zeros when nothing is held", () => {
    expect(roundedPercents([0, 0])).toEqual([0, 0]);
  });
});

describe("ratio", () => {
  it("guards against division by zero", () => {
    expect(ratio(5, 0)).toBe(0);
    expect(ratio(1, 4)).toBe(0.25);
  });
});

describe("formatting", () => {
  it("formats cents exactly", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(123456789)).toBe("$1,234,567.89");
    expect(formatCents(-1050)).toBe("-$10.50");
  });

  it("formats whole and compact styles", () => {
    expect(formatCents(123456789, "whole")).toBe("$1,234,568");
    expect(formatCents(123456789, "compact")).toBe("$1.2M");
  });

  it("formats basis points", () => {
    expect(formatBps(10000)).toBe("100%");
    expect(formatBps(3333)).toBe("33.33%");
    expect(formatBps(1250)).toBe("12.5%");
    expect(formatBps(5)).toBe("0.05%");
  });

  it("round-trips editable text", () => {
    expect(centsToInput(123456)).toBe("1234.56");
    expect(centsToInput(500)).toBe("5");
    expect(centsToInput(105)).toBe("1.05");
    expect(bpsToInput(1205)).toBe("12.05");
    expect(bpsToInput(1210)).toBe("12.1");
  });
});

describe("parseDollarsToCents", () => {
  it.each([
    ["0", 0],
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    [".25", 25],
    ["$1,234.56", 123456],
    [" 1 000 ", 100000],
    ["1000.", 100000],
  ])("parses %j", (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "1.234", "1,23", "$", ".", "1e5"])(
    "rejects %j",
    (input) => {
      expect(parseDollarsToCents(input)).toBeNull();
    },
  );

  it("avoids float error (0.1 + 0.2 style inputs)", () => {
    expect(parseDollarsToCents("0.29")).toBe(29);
    expect(parseDollarsToCents("1.13")).toBe(113);
  });
});

describe("parsePercentToBps", () => {
  it.each([
    ["100", 10000],
    ["33.33", 3333],
    ["12.5%", 1250],
    [".5", 50],
    ["0", 0],
  ])("parses %j", (input, bps) => {
    expect(parsePercentToBps(input)).toBe(bps);
  });

  it.each(["", "100.01", "101", "-1", "1.234", "abc"])("rejects %j", (input) => {
    expect(parsePercentToBps(input)).toBeNull();
  });
});
