import { describe, expect, it } from "vitest";
import { allocationFromCents, compactAllocation, remainingBps } from "./allocation";
import { emptyPortfolio, nextColorIndex, samplePortfolio } from "./defaults";
import { AccountSchema } from "./schema";
import {
  STORAGE_KEY,
  clearStorage,
  exportFileName,
  loadFromStorage,
  parsePortfolio,
  parsePortfolioJson,
  saveToStorage,
  serializePortfolio,
} from "./storage";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const validAccount = {
  id: "a1",
  name: "Roth IRA",
  type: "roth",
  balanceCents: 100_00,
  allocation: { "us-stocks": 10000 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("AccountSchema", () => {
  it("accepts a valid account", () => {
    expect(AccountSchema.safeParse(validAccount).success).toBe(true);
  });

  it.each([
    ["under 100%", { "us-stocks": 9999 }],
    ["over 100%", { "us-stocks": 6000, bonds: 4001 }],
    ["fractional bps", { "us-stocks": 9999.5, bonds: 0.5 }],
    ["negative bps", { "us-stocks": 10001, bonds: -1 }],
    ["empty", {}],
  ])("rejects an allocation %s", (_, allocation) => {
    expect(AccountSchema.safeParse({ ...validAccount, allocation }).success).toBe(false);
  });

  it.each([
    ["negative", -1],
    ["fractional", 10.5],
    ["huge", Number.MAX_SAFE_INTEGER],
  ])("rejects a %s balance", (_, balanceCents) => {
    expect(AccountSchema.safeParse({ ...validAccount, balanceCents }).success).toBe(false);
  });

  it("rejects a blank name and unknown type", () => {
    expect(AccountSchema.safeParse({ ...validAccount, name: "   " }).success).toBe(false);
    expect(AccountSchema.safeParse({ ...validAccount, type: "ira" }).success).toBe(false);
  });
});

describe("parsePortfolio", () => {
  it("accepts the sample portfolio", () => {
    expect(parsePortfolio(samplePortfolio()).ok).toBe(true);
  });

  it("rejects allocations that reference unknown asset classes", () => {
    const data = {
      ...emptyPortfolio(),
      accounts: [{ ...validAccount, allocation: { gold: 10000 } }],
    };
    const result = parsePortfolio(data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/Unknown asset class "gold"/);
  });

  it("rejects duplicate ids", () => {
    const data = { ...emptyPortfolio(), accounts: [validAccount, validAccount] };
    expect(parsePortfolio(data).ok).toBe(false);
  });

  it("explains missing or future schema versions", () => {
    const missing = parsePortfolio({ accounts: [] });
    const future = parsePortfolio({ ...emptyPortfolio(), schemaVersion: 99 });
    expect(missing).toEqual({ ok: false, errors: [expect.stringMatching(/schemaVersion/)] });
    expect(future).toEqual({ ok: false, errors: [expect.stringMatching(/version 99/)] });
  });

  it("rejects non-objects and bad JSON", () => {
    expect(parsePortfolio([]).ok).toBe(false);
    expect(parsePortfolio(null).ok).toBe(false);
    expect(parsePortfolioJson("{not json").ok).toBe(false);
  });
});

describe("export / import", () => {
  it("round-trips to identical data", () => {
    const data = samplePortfolio(new Date("2026-03-04T05:06:07.000Z"));
    const result = parsePortfolioJson(serializePortfolio(data));
    expect(result).toEqual({ ok: true, data });
  });

  it("names files by local date", () => {
    expect(exportFileName(new Date(2026, 0, 9))).toBe("stash-atlas-2026-01-09.json");
  });
});

describe("storage", () => {
  it("returns null when empty, then saves, loads, and clears", () => {
    const storage = memoryStorage();
    expect(loadFromStorage(storage)).toBeNull();
    const data = samplePortfolio();
    saveToStorage(storage, data);
    expect(loadFromStorage(storage)).toEqual({ ok: true, data });
    clearStorage(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("reports corrupted stored data", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{oops");
    expect(loadFromStorage(storage)?.ok).toBe(false);
  });
});

describe("allocation helpers", () => {
  it("tracks remaining percentage", () => {
    expect(remainingBps({ a: 6000, b: 3000 })).toBe(1000);
    expect(remainingBps({ a: 6000, b: 5000 })).toBe(-1000);
  });

  it("drops zero entries", () => {
    expect(compactAllocation({ a: 10000, b: 0 })).toEqual({ a: 10000 });
  });

  it("converts dollar amounts to a balance and basis points", () => {
    expect(allocationFromCents({ a: 100_00, b: 200_00, c: 0 })).toEqual({
      balanceCents: 300_00,
      allocation: { a: 3333, b: 6667 },
    });
    expect(allocationFromCents({ a: 0 })).toBeNull();
  });

  it("assigns colors to new classes without collisions", () => {
    expect(nextColorIndex(emptyPortfolio().assetClasses)).toBe(6);
  });
});
