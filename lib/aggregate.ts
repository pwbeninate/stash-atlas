import { largestRemainder, ratio } from "./money";
import {
  BPS_TOTAL,
  TAX_BUCKETS,
  TAX_BUCKET_BY_TREATMENT,
  TAX_TREATMENTS,
  type Account,
  type AssetClass,
  type PortfolioData,
  type TaxBucket,
  type TaxTreatment,
} from "./schema";

/**
 * Every aggregate below is derived from per-account cells produced by
 * `accountCells`, so all totals are integer sums that reconcile exactly.
 * Shares are plain ratios for sizing; use `roundedPercents` for display.
 */

/** Asset class ids in display order, plus any stray allocation keys. */
function classOrder(account: Account, assetClasses: AssetClass[]): string[] {
  const known = assetClasses.map((c) => c.id);
  const knownSet = new Set(known);
  const extra = Object.keys(account.allocation)
    .filter((id) => !knownSet.has(id))
    .sort();
  return [...known, ...extra];
}

/** One account's balance in cents per tax treatment; sums to the balance exactly. */
export function splitByTreatment(account: Account): Partial<Record<TaxTreatment, number>> {
  if (account.type !== "mixed") return { [account.type]: account.balanceCents };
  const rothBps = account.rothBps ?? 0;
  const [traditional, roth] = largestRemainder(account.balanceCents, [
    BPS_TOTAL - rothBps,
    rothBps,
  ]);
  return { traditional, roth };
}

export interface Cell {
  treatment: TaxTreatment;
  assetClassId: string;
  cents: number;
}

/**
 * One account split into non-zero cells: first by tax treatment (only
 * "mixed" accounts have two), then each part by the allocation. Both
 * mixed parts share the account's allocation.
 */
export function accountCells(account: Account, assetClasses: AssetClass[]): Cell[] {
  const ids = classOrder(account, assetClasses);
  const weights = ids.map((id) => account.allocation[id] ?? 0);
  const cells: Cell[] = [];
  for (const [treatment, portion] of Object.entries(splitByTreatment(account)) as [
    TaxTreatment,
    number,
  ][]) {
    largestRemainder(portion, weights).forEach((cents, i) => {
      if (cents > 0) cells.push({ treatment, assetClassId: ids[i], cents });
    });
  }
  return cells;
}

/** One account's balance in cents per asset class; sums to the balance exactly. */
export function splitAccount(
  account: Account,
  assetClasses: AssetClass[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const cell of accountCells(account, assetClasses)) {
    result[cell.assetClassId] = (result[cell.assetClassId] ?? 0) + cell.cents;
  }
  return result;
}

function allCells(data: PortfolioData): Cell[] {
  return data.accounts.flatMap((a) => accountCells(a, data.assetClasses));
}

export function totalCents(accounts: Account[]): number {
  return accounts.reduce((sum, a) => sum + a.balanceCents, 0);
}

export interface Slice<K extends string> {
  key: K;
  cents: number;
  share: number;
}

/** Portfolio-wide cents per asset class, in asset class order (zeros included). */
export function byAssetClass(data: PortfolioData): Slice<string>[] {
  const totals = new Map<string, number>(
    data.assetClasses.map((c) => [c.id, 0]),
  );
  for (const cell of allCells(data)) {
    totals.set(cell.assetClassId, (totals.get(cell.assetClassId) ?? 0) + cell.cents);
  }
  const total = totalCents(data.accounts);
  return [...totals].map(([key, cents]) => ({
    key,
    cents,
    share: ratio(cents, total),
  }));
}

export interface TreatmentSlice extends Slice<TaxTreatment> {
  /** Asset class id → cents held with this tax treatment. */
  byClass: Record<string, number>;
}

/**
 * Cents per tax treatment with its asset class split, in TAX_TREATMENTS
 * order. Mixed accounts contribute to both Traditional and Roth.
 */
export function byTaxTreatment(data: PortfolioData): TreatmentSlice[] {
  const total = totalCents(data.accounts);
  const slices = new Map<TaxTreatment, TreatmentSlice>(
    TAX_TREATMENTS.map((key) => [key, { key, cents: 0, share: 0, byClass: {} }]),
  );
  for (const cell of allCells(data)) {
    const slice = slices.get(cell.treatment)!;
    slice.cents += cell.cents;
    slice.byClass[cell.assetClassId] = (slice.byClass[cell.assetClassId] ?? 0) + cell.cents;
  }
  return [...slices.values()].map((s) => ({ ...s, share: ratio(s.cents, total) }));
}

/** Cents per tax bucket, in TAX_BUCKETS order. */
export function taxBuckets(data: PortfolioData): Slice<TaxBucket>[] {
  const totals = new Map<TaxBucket, number>(TAX_BUCKETS.map((b) => [b, 0]));
  for (const slice of byTaxTreatment(data)) {
    const bucket = TAX_BUCKET_BY_TREATMENT[slice.key];
    totals.set(bucket, (totals.get(bucket) ?? 0) + slice.cents);
  }
  const total = totalCents(data.accounts);
  return [...totals].map(([key, cents]) => ({
    key,
    cents,
    share: ratio(cents, total),
  }));
}

export interface MatrixCell {
  cents: number;
  /** Share of this asset class held with this tax treatment (row-normalized). */
  rowShare: number;
  /** Share of this tax treatment invested in this asset class (column-normalized). */
  colShare: number;
}

export interface MatrixRow {
  assetClassId: string;
  cells: Record<TaxTreatment, MatrixCell>;
  cents: number;
  share: number;
}

export interface MatrixColumn {
  treatment: TaxTreatment;
  cents: number;
  share: number;
}

export interface LocationMatrix {
  /** Asset classes with a non-zero total, in asset class order. */
  rows: MatrixRow[];
  /** Tax treatments with a non-zero total, in TAX_TREATMENTS order. */
  columns: MatrixColumn[];
  totalCents: number;
}

/** Asset class × tax treatment: the asset location view. */
export function locationMatrix(data: PortfolioData): LocationMatrix {
  const treatments = byTaxTreatment(data);
  const classes = byAssetClass(data);
  const total = totalCents(data.accounts);

  const columns: MatrixColumn[] = treatments
    .filter((t) => t.cents > 0)
    .map((t) => ({ treatment: t.key, cents: t.cents, share: t.share }));

  const rows: MatrixRow[] = classes
    .filter((c) => c.cents > 0)
    .map((c) => {
      const cells = {} as Record<TaxTreatment, MatrixCell>;
      for (const t of treatments) {
        const cents = t.byClass[c.key] ?? 0;
        cells[t.key] = {
          cents,
          rowShare: ratio(cents, c.cents),
          colShare: ratio(cents, t.cents),
        };
      }
      return { assetClassId: c.key, cells, cents: c.cents, share: c.share };
    });

  return { rows, columns, totalCents: total };
}
