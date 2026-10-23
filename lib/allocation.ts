import { largestRemainder } from "./money";
import { BPS_TOTAL, type Allocation } from "./schema";

export function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, v) => sum + v, 0);
}

/** Basis points still to assign (negative when over 100%). */
export function remainingBps(allocation: Record<string, number>): number {
  return BPS_TOTAL - sumValues(allocation);
}

/** Drop zero entries so stored allocations only list what's held. */
export function compactAllocation(allocation: Record<string, number>): Allocation {
  return Object.fromEntries(
    Object.entries(allocation).filter(([, bps]) => bps > 0),
  );
}

/**
 * Dollar-entry mode: the balance is the sum of the amounts, and the stored
 * allocation is their proportions in basis points (summing to exactly 100%).
 * Returns null when every amount is zero, since no proportion can be derived.
 */
export function allocationFromCents(
  centsByClass: Record<string, number>,
): { balanceCents: number; allocation: Allocation } | null {
  const ids = Object.keys(centsByClass);
  const amounts = ids.map((id) => centsByClass[id]);
  const balanceCents = amounts.reduce((sum, c) => sum + c, 0);
  if (balanceCents === 0) return null;
  const bps = largestRemainder(BPS_TOTAL, amounts);
  return {
    balanceCents,
    allocation: compactAllocation(
      Object.fromEntries(ids.map((id, i) => [id, bps[i]])),
    ),
  };
}
