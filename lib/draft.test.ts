import { describe, expect, it } from "vitest";
import { DEFAULT_ASSET_CLASSES } from "./defaults";
import {
  draftFromAccount,
  emptyDraft,
  evaluateDraft,
  switchDraftMode,
  switchRothUnit,
  type AccountDraft,
} from "./draft";
import { AccountSchema } from "./schema";

const classes = DEFAULT_ASSET_CLASSES;

function draft(overrides: Partial<AccountDraft>): AccountDraft {
  return { ...emptyDraft(), name: "Brokerage", ...overrides };
}

describe("percent mode", () => {
  it("accepts a balance and percentages totaling 100%", () => {
    const result = evaluateDraft(
      draft({ balance: "10,000.01", percents: { "us-stocks": "60", bonds: "40" } }),
      classes,
    );
    expect(result.value).toEqual({
      name: "Brokerage",
      type: "taxable",
      balanceCents: 1_000_001,
      allocation: { "us-stocks": 6000, bonds: 4000 },
    });
    expect(result.centsByClass).toEqual({ "us-stocks": 600_001, bonds: 400_000 });
    expect(result.remainingBps).toBe(0);
  });

  it("accepts thirds entered with two decimals", () => {
    const result = evaluateDraft(
      draft({
        balance: "100",
        percents: { "us-stocks": "33.33", "intl-stocks": "33.33", bonds: "33.34" },
      }),
      classes,
    );
    expect(result.value?.allocation).toEqual({
      "us-stocks": 3333,
      "intl-stocks": 3333,
      bonds: 3334,
    });
  });

  it("blocks saving when under 100% and reports what's left", () => {
    const result = evaluateDraft(
      draft({ balance: "100", percents: { "us-stocks": "60", bonds: "39.99" } }),
      classes,
    );
    expect(result.value).toBeNull();
    expect(result.remainingBps).toBe(1);
    expect(result.errors.allocation).toMatch(/0\.01% is unassigned/);
  });

  it("blocks saving when over 100%", () => {
    const result = evaluateDraft(
      draft({ balance: "100", percents: { "us-stocks": "70", bonds: "40" } }),
      classes,
    );
    expect(result.value).toBeNull();
    expect(result.remainingBps).toBe(-1000);
    expect(result.errors.allocation).toMatch(/10% too much/);
  });

  it("flags unparseable entries per field", () => {
    const result = evaluateDraft(
      draft({ balance: "100", percents: { "us-stocks": "abc", bonds: "100" } }),
      classes,
    );
    expect(result.value).toBeNull();
    expect(result.errors.fields["us-stocks"]).toBeDefined();
  });

  it("requires a name and a valid balance", () => {
    const result = evaluateDraft(
      draft({ name: "  ", balance: "-5", percents: { cash: "100" } }),
      classes,
    );
    expect(result.value).toBeNull();
    expect(result.errors.name).toBeDefined();
    expect(result.errors.balance).toBeDefined();
    expect(evaluateDraft(draft({ percents: { cash: "100" } }), classes).errors.balance).toBe(
      "Enter the balance.",
    );
  });

  it("allows a zero balance with a full allocation", () => {
    const result = evaluateDraft(draft({ balance: "0", percents: { cash: "100" } }), classes);
    expect(result.value?.balanceCents).toBe(0);
  });

  it("produces values that pass the stored schema", () => {
    const { value } = evaluateDraft(
      draft({ balance: "1", percents: { cash: "100" } }),
      classes,
    );
    const account = {
      ...value!,
      id: "x",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(AccountSchema.safeParse(account).success).toBe(true);
  });
});

describe("dollar mode", () => {
  it("derives the balance and basis points from amounts", () => {
    const result = evaluateDraft(
      draft({ mode: "dollars", dollars: { "us-stocks": "1,000", bonds: "500.50" } }),
      classes,
    );
    expect(result.value).toEqual({
      name: "Brokerage",
      type: "taxable",
      balanceCents: 150_050,
      allocation: { "us-stocks": 6664, bonds: 3336 },
    });
  });

  it("requires at least one non-zero amount", () => {
    const result = evaluateDraft(draft({ mode: "dollars", dollars: { cash: "0" } }), classes);
    expect(result.value).toBeNull();
    expect(result.errors.allocation).toBeDefined();
  });
});

describe("switchDraftMode", () => {
  it("converts valid percentages to dollars and back", () => {
    const start = draft({ balance: "1000", percents: { "us-stocks": "75", cash: "25" } });
    const dollars = switchDraftMode(start, classes, "dollars");
    expect(dollars.dollars).toEqual({ "us-stocks": "750", cash: "250" });
    const back = switchDraftMode(dollars, classes, "percent");
    expect(back.percents).toEqual({ "us-stocks": "75", cash: "25" });
    expect(back.balance).toBe("1000");
  });

  it("keeps the other mode's text when the current mode is invalid", () => {
    const start = draft({
      balance: "1000",
      percents: { cash: "50" },
      dollars: { bonds: "12" },
    });
    expect(switchDraftMode(start, classes, "dollars")).toEqual({ ...start, mode: "dollars" });
  });
});

describe("draftFromAccount", () => {
  it("round-trips through evaluation", () => {
    const account = {
      id: "a",
      name: "Roth IRA",
      type: "roth" as const,
      balanceCents: 6_188_005,
      allocation: { "us-stocks": 6000, "intl-stocks": 2950, "real-estate": 1050 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const { value } = evaluateDraft(draftFromAccount(account), classes);
    expect(value).toEqual({
      name: account.name,
      type: account.type,
      balanceCents: account.balanceCents,
      allocation: account.allocation,
    });
  });
});

describe("Traditional + Roth (mixed) accounts", () => {
  const base = { type: "mixed" as const, balance: "100,000", percents: { "us-stocks": "100" } };

  it("takes the Roth portion in dollars", () => {
    const result = evaluateDraft(draft({ ...base, roth: "25,000", rothUnit: "dollars" }), classes);
    expect(result.value).toMatchObject({ type: "mixed", rothBps: 2500 });
    expect(result.rothCents).toBe(2_500_000);
  });

  it("takes the Roth portion in percent", () => {
    const result = evaluateDraft(draft({ ...base, roth: "30", rothUnit: "percent" }), classes);
    expect(result.value?.rothBps).toBe(3000);
    expect(result.rothCents).toBe(3_000_000);
  });

  it("requires a Roth portion no larger than the balance", () => {
    expect(evaluateDraft(draft({ ...base, roth: "" }), classes).errors.roth).toMatch(/Roth/);
    const over = evaluateDraft(draft({ ...base, roth: "100,000.01" }), classes);
    expect(over.value).toBeNull();
    expect(over.errors.roth).toMatch(/more than the balance/);
    expect(evaluateDraft(draft({ ...base, roth: "101", rothUnit: "percent" }), classes).value).toBeNull();
  });

  it("asks for a percentage when the balance is $0", () => {
    const zero = { ...base, balance: "0" };
    expect(evaluateDraft(draft({ ...zero, roth: "0" }), classes).errors.roth).toMatch(/percentage/);
    expect(
      evaluateDraft(draft({ ...zero, roth: "40", rothUnit: "percent" }), classes).value?.rothBps,
    ).toBe(4000);
  });

  it("works with dollar-mode allocation, where the balance is the sum", () => {
    const result = evaluateDraft(
      draft({
        type: "mixed",
        mode: "dollars",
        dollars: { "us-stocks": "600", bonds: "400" },
        roth: "250",
      }),
      classes,
    );
    expect(result.value).toMatchObject({ balanceCents: 100_000, rothBps: 2500 });
  });

  it("ignores the Roth field for other account types", () => {
    const result = evaluateDraft(draft({ ...base, type: "traditional", roth: "junk" }), classes);
    expect(result.value).not.toHaveProperty("rothBps");
    expect(result.errors.roth).toBeUndefined();
  });

  it("converts between dollars and percent", () => {
    const start = draft({ ...base, roth: "25,000" });
    const pct = switchRothUnit(start, classes, "percent");
    expect(pct).toMatchObject({ rothUnit: "percent", roth: "25" });
    expect(switchRothUnit(pct, classes, "dollars")).toMatchObject({
      rothUnit: "dollars",
      roth: "25000",
    });
  });

  it("starts a new split in dollars when an existing account becomes mixed", () => {
    const account = {
      id: "t",
      name: "401(k)",
      type: "traditional" as const,
      balanceCents: 100_00,
      allocation: { cash: 10000 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(draftFromAccount(account)).toMatchObject({ roth: "", rothUnit: "dollars" });
  });

  it("round-trips a saved mixed account", () => {
    const account = {
      id: "m",
      name: "Acme 401(k)",
      type: "mixed" as const,
      balanceCents: 21_240_000,
      allocation: { "us-stocks": 10000 },
      rothBps: 2550,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(evaluateDraft(draftFromAccount(account), classes).value).toEqual({
      name: account.name,
      type: account.type,
      balanceCents: account.balanceCents,
      allocation: account.allocation,
      rothBps: 2550,
    });
  });
});
