import { largestRemainder, ratio } from "./money";
import {
  ACCOUNT_TYPES,
  TAX_BUCKETS,
  TAX_BUCKET_BY_TYPE,
  type Account,
  type AccountType,
  type AssetClass,
  type PortfolioData,
  type TaxBucket,
} from "./schema";

/**
 * Every aggregate below is derived from per-account cents produced by
 * `splitAccount`, so all totals are integer sums that reconcile exactly.
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

/** One account's balance in cents per asset class; sums to the balance exactly. */
export function splitAccount(
  account: Account,
  assetClasses: AssetClass[],
): Record<string, number> {
  const ids = classOrder(account, assetClasses);
  const cents = largestRemainder(
    account.balanceCents,
    ids.map((id) => account.allocation[id] ?? 0),
  );
  const result: Record<string, number> = {};
  ids.forEach((id, i) => {
    if (cents[i] > 0) result[id] = cents[i];
  });
  return result;
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
  for (const account of data.accounts) {
    for (const [id, cents] of Object.entries(
      splitAccount(account, data.assetClasses),
    )) {
      totals.set(id, (totals.get(id) ?? 0) + cents);
    }
  }
  const total = totalCents(data.accounts);
  return [...totals].map(([key, cents]) => ({
    key,
    cents,
    share: ratio(cents, total),
  }));
}

export interface AccountTypeSlice extends Slice<AccountType> {
  /** Asset class id → cents held in this account type. */
  byClass: Record<string, number>;
}

/** Cents per account type with its asset class split, in ACCOUNT_TYPES order. */
export function byAccountType(data: PortfolioData): AccountTypeSlice[] {
  const total = totalCents(data.accounts);
  return ACCOUNT_TYPES.map((type) => {
    const byClass: Record<string, number> = {};
    let cents = 0;
    for (const account of data.accounts) {
      if (account.type !== type) continue;
      cents += account.balanceCents;
      for (const [id, c] of Object.entries(
        splitAccount(account, data.assetClasses),
      )) {
        byClass[id] = (byClass[id] ?? 0) + c;
      }
    }
    return { key: type, cents, share: ratio(cents, total), byClass };
  });
}

/** Cents per tax bucket, in TAX_BUCKETS order. */
export function taxBuckets(data: PortfolioData): Slice<TaxBucket>[] {
  const totals = new Map<TaxBucket, number>(TAX_BUCKETS.map((b) => [b, 0]));
  for (const account of data.accounts) {
    const bucket = TAX_BUCKET_BY_TYPE[account.type];
    totals.set(bucket, (totals.get(bucket) ?? 0) + account.balanceCents);
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
  /** Share of this asset class held in this account type (row-normalized). */
  rowShare: number;
  /** Share of this account type invested in this asset class (column-normalized). */
  colShare: number;
}

export interface MatrixRow {
  assetClassId: string;
  cells: Record<AccountType, MatrixCell>;
  cents: number;
  share: number;
}

export interface MatrixColumn {
  type: AccountType;
  cents: number;
  share: number;
}

export interface LocationMatrix {
  /** Asset classes with a non-zero total, in asset class order. */
  rows: MatrixRow[];
  /** Account types with a non-zero total, in ACCOUNT_TYPES order. */
  columns: MatrixColumn[];
  totalCents: number;
}

/** Asset class × account type: the asset location view. */
export function locationMatrix(data: PortfolioData): LocationMatrix {
  const types = byAccountType(data);
  const classes = byAssetClass(data);
  const total = totalCents(data.accounts);

  const columns: MatrixColumn[] = types
    .filter((t) => t.cents > 0)
    .map((t) => ({ type: t.key, cents: t.cents, share: t.share }));

  const rows: MatrixRow[] = classes
    .filter((c) => c.cents > 0)
    .map((c) => {
      const cells = {} as Record<AccountType, MatrixCell>;
      for (const t of types) {
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
