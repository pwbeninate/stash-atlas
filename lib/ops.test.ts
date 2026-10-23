import { describe, expect, it } from "vitest";
import { emptyPortfolio } from "./defaults";
import {
  accountsUsingClass,
  addAccount,
  addAssetClass,
  deleteAccount,
  deleteAssetClass,
  renameAssetClass,
  updateAccount,
} from "./ops";
import { parsePortfolio } from "./storage";

const T1 = new Date("2026-01-01T00:00:00.000Z");
const T2 = new Date("2026-02-01T00:00:00.000Z");
const fields = {
  name: "Brokerage",
  type: "taxable" as const,
  balanceCents: 100_00,
  allocation: { "us-stocks": 10000 },
};

describe("accounts", () => {
  it("adds, updates, and deletes while staying schema-valid", () => {
    let data = addAccount(emptyPortfolio(), fields, T1, "a1");
    expect(data.accounts[0]).toMatchObject({
      id: "a1",
      createdAt: T1.toISOString(),
      updatedAt: T1.toISOString(),
    });
    data = updateAccount(data, "a1", { ...fields, balanceCents: 5 }, T2);
    expect(data.accounts[0]).toMatchObject({
      balanceCents: 5,
      createdAt: T1.toISOString(),
      updatedAt: T2.toISOString(),
    });
    expect(parsePortfolio(data).ok).toBe(true);
    expect(deleteAccount(data, "a1").accounts).toEqual([]);
  });

  it("drops the Roth share when an account stops being mixed", () => {
    let data = addAccount(emptyPortfolio(), { ...fields, type: "mixed", rothBps: 4000 }, T1, "m");
    expect(data.accounts[0].rothBps).toBe(4000);
    data = updateAccount(data, "m", fields, T2);
    expect(data.accounts[0]).not.toHaveProperty("rothBps");
    expect(parsePortfolio(data).ok).toBe(true);
  });
});

describe("asset classes", () => {
  it("adds a custom class with the next free color", () => {
    const result = addAssetClass(emptyPortfolio(), "  Gold ", "gold");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.assetClasses.at(-1)).toEqual({
        id: "gold",
        name: "Gold",
        colorIndex: 6,
        builtIn: false,
      });
    }
  });

  it("rejects blank or duplicate names (case-insensitive)", () => {
    expect(addAssetClass(emptyPortfolio(), " ").ok).toBe(false);
    expect(addAssetClass(emptyPortfolio(), "bonds").ok).toBe(false);
    expect(renameAssetClass(emptyPortfolio(), "cash", "BONDS").ok).toBe(false);
    expect(renameAssetClass(emptyPortfolio(), "cash", "Cash").ok).toBe(true);
  });

  it("blocks deleting a class that an account holds", () => {
    const data = addAccount(emptyPortfolio(), fields, T1, "a1");
    expect(accountsUsingClass(data, "us-stocks").map((a) => a.id)).toEqual(["a1"]);
    const result = deleteAssetClass(data, "us-stocks");
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/Brokerage/) });
  });

  it("deletes an unused class and strips zero-weight references", () => {
    const data = addAccount(
      emptyPortfolio(),
      { ...fields, allocation: { "us-stocks": 10000, bonds: 0 } },
      T1,
      "a1",
    );
    const result = deleteAssetClass(data, "bonds");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.assetClasses.some((c) => c.id === "bonds")).toBe(false);
      expect(result.data.accounts[0].allocation).toEqual({ "us-stocks": 10000 });
      expect(parsePortfolio(result.data).ok).toBe(true);
    }
  });
});
