import { describe, expect, it } from "vitest";
import { DEFAULT_ASSET_CLASSES } from "./defaults";
import {
  draftFromAccount,
  emptyDraft,
  evaluateDraft,
  switchDraftMode,
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
