import { describe, expect, it } from "vitest";
import {
  accountCells,
  byAssetClass,
  byTaxTreatment,
  locationMatrix,
  splitAccount,
  splitByTreatment,
  taxBuckets,
  totalCents,
} from "./aggregate";
import { DEFAULT_ASSET_CLASSES, emptyPortfolio, samplePortfolio } from "./defaults";
import type { Account, AccountType, PortfolioData } from "./schema";

const NOW = "2026-01-01T00:00:00.000Z";
let seq = 0;

function account(
  type: AccountType,
  balanceCents: number,
  allocation: Record<string, number>,
  rothBps?: number,
): Account {
  seq += 1;
  return {
    id: `a${seq}`,
    name: `Account ${seq}`,
    type,
    balanceCents,
    allocation,
    ...(rothBps === undefined ? {} : { rothBps }),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function portfolio(...accounts: Account[]): PortfolioData {
  return { ...emptyPortfolio(), accounts };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Every row, column, and the grand total must reconcile exactly. */
function expectMatrixReconciles(data: PortfolioData) {
  const m = locationMatrix(data);
  for (const row of m.rows) {
    expect(sum(Object.values(row.cells).map((c) => c.cents))).toBe(row.cents);
  }
  for (const col of m.columns) {
    expect(sum(m.rows.map((r) => r.cells[col.treatment].cents))).toBe(col.cents);
  }
  expect(sum(m.rows.map((r) => r.cents))).toBe(m.totalCents);
  expect(sum(m.columns.map((c) => c.cents))).toBe(m.totalCents);
  expect(m.totalCents).toBe(totalCents(data.accounts));
}

describe("splitAccount", () => {
  it("splits a balance exactly by basis points", () => {
    const a = account("taxable", 100_000, { "us-stocks": 6000, bonds: 4000 });
    expect(splitAccount(a, DEFAULT_ASSET_CLASSES)).toEqual({
      "us-stocks": 60_000,
      bonds: 40_000,
    });
  });

  it("never loses a cent on odd balances", () => {
    const a = account("taxable", 100_01, {
      "us-stocks": 3333,
      "intl-stocks": 3333,
      bonds: 3334,
    });
    const split = splitAccount(a, DEFAULT_ASSET_CLASSES);
    expect(sum(Object.values(split))).toBe(100_01);
  });

  it("returns nothing for a zero balance", () => {
    const a = account("roth", 0, { "us-stocks": 10000 });
    expect(splitAccount(a, DEFAULT_ASSET_CLASSES)).toEqual({});
  });
});

describe("empty portfolio", () => {
  const data = portfolio();

  it("has zero totals and no NaN shares", () => {
    expect(totalCents(data.accounts)).toBe(0);
    for (const s of [...byAssetClass(data), ...taxBuckets(data), ...byTaxTreatment(data)]) {
      expect(s.cents).toBe(0);
      expect(s.share).toBe(0);
    }
  });

  it("has an empty matrix", () => {
    expect(locationMatrix(data)).toEqual({ rows: [], columns: [], totalCents: 0 });
  });
});

describe("zero-balance accounts", () => {
  it("contribute nothing and produce no NaN", () => {
    const data = portfolio(
      account("roth", 0, { "us-stocks": 10000 }),
      account("hsa", 0, { cash: 10000 }),
    );
    const m = locationMatrix(data);
    expect(m.rows).toEqual([]);
    expect(m.columns).toEqual([]);
    expect(taxBuckets(data).every((b) => b.share === 0)).toBe(true);
  });

  it("don't disturb other accounts", () => {
    const data = portfolio(
      account("roth", 0, { "us-stocks": 10000 }),
      account("taxable", 50_000, { bonds: 10000 }),
    );
    const m = locationMatrix(data);
    expect(m.columns.map((c) => c.treatment)).toEqual(["taxable"]);
    expect(m.rows.map((r) => r.assetClassId)).toEqual(["bonds"]);
    expect(m.rows[0].cells.taxable.rowShare).toBe(1);
  });
});

describe("single account, all in one asset class", () => {
  const data = portfolio(account("traditional", 1_234_567, { bonds: 10000 }));

  it("puts 100% everywhere it should", () => {
    const classes = byAssetClass(data);
    expect(classes.find((c) => c.key === "bonds")).toMatchObject({
      cents: 1_234_567,
      share: 1,
    });
    expect(classes.filter((c) => c.key !== "bonds").every((c) => c.cents === 0)).toBe(
      true,
    );

    const m = locationMatrix(data);
    expect(m.rows).toHaveLength(1);
    expect(m.columns).toHaveLength(1);
    expect(m.rows[0].cells.traditional).toEqual({
      cents: 1_234_567,
      rowShare: 1,
      colShare: 1,
    });
    expect(taxBuckets(data).find((b) => b.key === "pretax")?.share).toBe(1);
  });
});

describe("multi-account portfolio", () => {
  const data = portfolio(
    account("taxable", 100_000_00, { "us-stocks": 8000, cash: 2000 }),
    account("traditional", 200_000_00, { "us-stocks": 5000, bonds: 5000 }),
    account("roth", 50_000_00, { "intl-stocks": 10000 }),
    account("hsa", 10_000_00, { "us-stocks": 10000 }),
    account("529", 40_000_00, { "us-stocks": 5000, bonds: 5000 }),
  );

  it("aggregates by asset class", () => {
    const classes = Object.fromEntries(byAssetClass(data).map((c) => [c.key, c.cents]));
    expect(classes["us-stocks"]).toBe(80_000_00 + 100_000_00 + 10_000_00 + 20_000_00);
    expect(classes.bonds).toBe(100_000_00 + 20_000_00);
    expect(classes["intl-stocks"]).toBe(50_000_00);
    expect(classes.cash).toBe(20_000_00);
  });

  it("aggregates by tax treatment with class splits", () => {
    const traditional = byTaxTreatment(data).find((t) => t.key === "traditional");
    expect(traditional).toMatchObject({
      cents: 200_000_00,
      share: 0.5,
      byClass: { "us-stocks": 100_000_00, bonds: 100_000_00 },
    });
  });

  it("groups Roth, HSA, and 529 as tax-free", () => {
    const buckets = Object.fromEntries(taxBuckets(data).map((b) => [b.key, b.cents]));
    expect(buckets).toEqual({
      taxable: 100_000_00,
      pretax: 200_000_00,
      taxfree: 100_000_00,
      other: 0,
    });
  });

  it("computes row and column shares in the matrix", () => {
    const m = locationMatrix(data);
    const bonds = m.rows.find((r) => r.assetClassId === "bonds")!;
    // $120k of bonds: $100k in traditional, $20k in 529.
    expect(bonds.cells.traditional.rowShare).toBeCloseTo(100 / 120, 12);
    expect(bonds.cells["529"].rowShare).toBeCloseTo(20 / 120, 12);
    expect(bonds.cells.traditional.colShare).toBe(0.5);
    expect(bonds.cells.taxable.cents).toBe(0);
    expect(m.columns.map((c) => c.treatment)).toEqual([
      "taxable",
      "traditional",
      "roth",
      "hsa",
      "529",
    ]);
    // Rows follow asset class order and skip unused classes.
    expect(m.rows.map((r) => r.assetClassId)).toEqual([
      "us-stocks",
      "intl-stocks",
      "bonds",
      "cash",
    ]);
    expectMatrixReconciles(data);
  });
});

describe("rounding", () => {
  it("reconciles exactly with thirds on odd-cent balances", () => {
    const thirds = { "us-stocks": 3333, "intl-stocks": 3333, bonds: 3334 };
    const data = portfolio(
      account("taxable", 1, thirds),
      account("taxable", 2, thirds),
      account("roth", 100_01, thirds),
      account("traditional", 333_333_33, thirds),
      account("hsa", 7, { cash: 1, "us-stocks": 9999 }),
    );
    expectMatrixReconciles(data);
    expect(sum(byAssetClass(data).map((c) => c.cents))).toBe(totalCents(data.accounts));
    expect(sum(taxBuckets(data).map((b) => b.cents))).toBe(totalCents(data.accounts));
  });

  it("reconciles the sample portfolio", () => {
    expectMatrixReconciles(samplePortfolio());
  });
});

describe("Traditional + Roth (mixed) accounts", () => {
  const mixed = account("mixed", 100_000_00, { "us-stocks": 6000, bonds: 4000 }, 2500);

  it("splits the balance between traditional and Roth", () => {
    expect(splitByTreatment(mixed)).toEqual({ traditional: 75_000_00, roth: 25_000_00 });
    expect(splitByTreatment(account("roth", 5, { cash: 10000 }))).toEqual({ roth: 5 });
  });

  it("applies the same allocation to both parts", () => {
    expect(accountCells(mixed, DEFAULT_ASSET_CLASSES)).toEqual([
      { treatment: "traditional", assetClassId: "us-stocks", cents: 45_000_00 },
      { treatment: "traditional", assetClassId: "bonds", cents: 30_000_00 },
      { treatment: "roth", assetClassId: "us-stocks", cents: 15_000_00 },
      { treatment: "roth", assetClassId: "bonds", cents: 10_000_00 },
    ]);
    expect(splitAccount(mixed, DEFAULT_ASSET_CLASSES)).toEqual({
      "us-stocks": 60_000_00,
      bonds: 40_000_00,
    });
  });

  it("counts toward the Traditional and Roth columns and buckets", () => {
    const data = portfolio(mixed, account("roth", 10_000_00, { cash: 10000 }));
    const m = locationMatrix(data);
    expect(m.columns.map((c) => [c.treatment, c.cents])).toEqual([
      ["traditional", 75_000_00],
      ["roth", 35_000_00],
    ]);
    const buckets = Object.fromEntries(taxBuckets(data).map((b) => [b.key, b.cents]));
    expect(buckets).toMatchObject({ pretax: 75_000_00, taxfree: 35_000_00 });
    expectMatrixReconciles(data);
  });

  it("handles all-Roth, all-traditional, and odd-cent splits exactly", () => {
    const thirds = { "us-stocks": 3333, "intl-stocks": 3333, bonds: 3334 };
    const data = portfolio(
      account("mixed", 1_000_01, thirds, 0),
      account("mixed", 1_000_01, thirds, 10000),
      account("mixed", 7, thirds, 3333),
      account("mixed", 333_333_33, thirds, 1),
      account("mixed", 0, thirds, 5000),
    );
    expect(splitByTreatment(data.accounts[0])).toEqual({ traditional: 1_000_01, roth: 0 });
    expect(splitByTreatment(data.accounts[1])).toEqual({ traditional: 0, roth: 1_000_01 });
    for (const a of data.accounts) {
      expect(sum(accountCells(a, DEFAULT_ASSET_CLASSES).map((c) => c.cents))).toBe(
        a.balanceCents,
      );
    }
    expectMatrixReconciles(data);
  });
});
