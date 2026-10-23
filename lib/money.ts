import { BPS_TOTAL } from "./schema";

/**
 * Split a non-negative integer `total` across `weights` in proportion,
 * returning integers that sum to exactly `total` (Hamilton / largest
 * remainder method). Ties go to the earlier index so results are stable.
 * BigInt keeps `total * weight` exact even for very large balances.
 */
export function largestRemainder(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError(`total must be a non-negative safe integer, got ${total}`);
  }
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w < 0) {
      throw new RangeError(`weights must be non-negative safe integers, got ${w}`);
    }
  }

  const weightSum = weights.reduce((sum, w) => sum + BigInt(w), 0n);
  if (weightSum === 0n || total === 0) return weights.map(() => 0);

  const bigTotal = BigInt(total);
  const floors: bigint[] = [];
  const remainders: { index: number; remainder: bigint }[] = [];
  let allocated = 0n;

  weights.forEach((w, index) => {
    const product = bigTotal * BigInt(w);
    const floor = product / weightSum;
    floors.push(floor);
    remainders.push({ index, remainder: product % weightSum });
    allocated += floor;
  });

  let leftover = Number(bigTotal - allocated);
  remainders.sort((a, b) =>
    a.remainder === b.remainder
      ? a.index - b.index
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const { index } of remainders) {
    if (leftover === 0) break;
    floors[index] += 1n;
    leftover -= 1;
  }

  return floors.map(Number);
}

/**
 * Percentages for display that add up to exactly 100 at the given precision,
 * e.g. [1, 1, 1] → [33.4, 33.3, 33.3]. All-zero input yields all zeros.
 */
export function roundedPercents(values: number[], decimals = 1): number[] {
  const scale = 10 ** decimals;
  return largestRemainder(100 * scale, values).map((v) => v / scale);
}

/** Ratio for sizing and shading; 0 when the denominator is 0. */
export function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export type MoneyStyle = "exact" | "whole" | "compact";

/** The single place cents become a display string. */
export function formatCents(cents: number, style: MoneyStyle = "exact"): string {
  if (style === "exact") {
    // Integer math keeps the cents exact for any safe-integer amount.
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(cents);
    const dollars = Math.trunc(abs / 100);
    const rem = abs % 100;
    return `${sign}${usdWhole.format(dollars)}.${String(rem).padStart(2, "0")}`;
  }
  return (style === "compact" ? usdCompact : usdWhole).format(cents / 100);
}

/** Format a display percentage (e.g. 33.3 → "33.3%"). */
export function formatPercent(percent: number, decimals = 1): string {
  return `${percent.toFixed(decimals)}%`;
}

/** Format stored basis points (e.g. 3333 → "33.33%", 6000 → "60%"). */
export function formatBps(bps: number): string {
  return `${bpsToInput(bps)}%`;
}

const DOLLARS_RE = /^\$?((?:\d{1,3}(?:,\d{3})+)|\d+)?(?:\.(\d{0,2}))?$/;

/**
 * Parse a user-typed dollar amount ("1,234.5", "$80", ".25") into cents
 * without going through floating point. Returns null for invalid input.
 */
export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/\s+/g, "");
  const match = DOLLARS_RE.exec(trimmed);
  if (!match) return null;
  const [, whole = "", frac] = match;
  if (whole === "" && (frac === undefined || frac === "")) return null;
  const cents =
    Number(whole.replaceAll(",", "") || "0") * 100 +
    Number((frac ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

const PERCENT_RE = /^(\d{1,3})?(?:\.(\d{0,2}))?%?$/;

/** Parse "33.33", "60%", ".5" into basis points; null if invalid or > 100%. */
export function parsePercentToBps(input: string): number | null {
  const trimmed = input.trim();
  const match = PERCENT_RE.exec(trimmed);
  if (!match) return null;
  const [, whole = "", frac] = match;
  if (whole === "" && (frac === undefined || frac === "")) return null;
  const bps = Number(whole || "0") * 100 + Number((frac ?? "").padEnd(2, "0"));
  return bps <= BPS_TOTAL ? bps : null;
}

/** Cents → editable text, e.g. 123456 → "1234.56", 500 → "5". */
export function centsToInput(cents: number): string {
  const dollars = Math.trunc(cents / 100);
  const rem = cents % 100;
  return rem === 0 ? String(dollars) : `${dollars}.${String(rem).padStart(2, "0")}`;
}

/** Basis points → editable text, e.g. 3333 → "33.33", 6000 → "60", 1250 → "12.5". */
export function bpsToInput(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const rem = bps % 100;
  if (rem === 0) return String(whole);
  return `${whole}.${String(rem).padStart(2, "0").replace(/0$/, "")}`;
}
