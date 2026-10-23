import { allocationFromCents, compactAllocation, remainingBps } from "./allocation";
import {
  bpsToInput,
  centsToInput,
  formatBps,
  formatCents,
  largestRemainder,
  parseDollarsToCents,
  parsePercentToBps,
} from "./money";
import {
  BPS_TOTAL,
  MAX_BALANCE_CENTS,
  type Account,
  type AccountType,
  type Allocation,
  type AssetClass,
} from "./schema";

/**
 * The account form's raw text state and its validation. Kept pure so the
 * rules that decide whether an account can be saved are unit-tested.
 */

export type EntryMode = "percent" | "dollars";

export interface AccountDraft {
  name: string;
  type: AccountType;
  mode: EntryMode;
  /** Balance text, used in percent mode. */
  balance: string;
  /** Asset class id → percent text (percent mode). */
  percents: Record<string, string>;
  /** Asset class id → dollar text (dollar mode). */
  dollars: Record<string, string>;
  /** "mixed" accounts: the Roth portion as text, in `rothUnit`. */
  roth: string;
  rothUnit: EntryMode;
}

export interface AccountFields {
  name: string;
  type: AccountType;
  balanceCents: number;
  allocation: Allocation;
  /** Present only for "mixed" accounts. */
  rothBps?: number;
}

export interface DraftErrors {
  name?: string;
  balance?: string;
  allocation?: string;
  roth?: string;
  /** Asset class id → message for an unparseable entry. */
  fields: Record<string, string>;
}

export interface DraftEvaluation {
  /** Parsed balance (percent mode) or sum of amounts (dollar mode). */
  balanceCents: number | null;
  /** Valid entries as basis points (derived from dollars in dollar mode). */
  bpsByClass: Record<string, number>;
  /** Valid entries as cents (derived from percents in percent mode). */
  centsByClass: Record<string, number>;
  /** Percent mode: 100% minus what's entered. Always 0 in a valid dollar draft. */
  remainingBps: number;
  /** "mixed" accounts: the parsed Roth share and, when the balance is known, its cents. */
  rothBps: number | null;
  rothCents: number | null;
  errors: DraftErrors;
  /** Present only when the draft is saveable. */
  value: AccountFields | null;
}

export function emptyDraft(type: AccountType = "taxable"): AccountDraft {
  return {
    name: "",
    type,
    mode: "percent",
    balance: "",
    percents: {},
    dollars: {},
    roth: "",
    rothUnit: "dollars",
  };
}

export function draftFromAccount(account: Account): AccountDraft {
  const percents: Record<string, string> = {};
  for (const [id, bps] of Object.entries(account.allocation)) {
    if (bps > 0) percents[id] = bpsToInput(bps);
  }
  return {
    name: account.name,
    type: account.type,
    mode: "percent",
    balance: centsToInput(account.balanceCents),
    percents,
    dollars: {},
    // A saved Roth share is stored as a percentage, so show it that way; a new
    // split starts in dollars, matching how statements report each source.
    roth: account.rothBps === undefined ? "" : bpsToInput(account.rothBps),
    rothUnit: account.rothBps === undefined ? "dollars" : "percent",
  };
}

function hasErrors(errors: DraftErrors): boolean {
  return Boolean(
    errors.name ||
      errors.balance ||
      errors.allocation ||
      errors.roth ||
      Object.keys(errors.fields).length,
  );
}

/** Parse the Roth portion of a "mixed" draft against the (possibly unknown) balance. */
function evaluateRoth(
  draft: AccountDraft,
  balanceCents: number | null,
  errors: DraftErrors,
): { rothBps: number | null; rothCents: number | null } {
  if (draft.type !== "mixed") return { rothBps: null, rothCents: null };
  const text = draft.roth.trim();
  if (text === "") {
    errors.roth = "Enter how much of the balance is Roth.";
    return { rothBps: null, rothCents: null };
  }

  if (draft.rothUnit === "percent") {
    const rothBps = parsePercentToBps(text);
    if (rothBps === null) {
      errors.roth = "Use 0–100 with up to 2 decimals.";
      return { rothBps: null, rothCents: null };
    }
    const rothCents =
      balanceCents === null
        ? null
        : largestRemainder(balanceCents, [BPS_TOTAL - rothBps, rothBps])[1];
    return { rothBps, rothCents };
  }

  const rothCents = parseDollarsToCents(text);
  if (rothCents === null) {
    errors.roth = "Enter a dollar amount.";
    return { rothBps: null, rothCents: null };
  }
  if (balanceCents === null) return { rothBps: null, rothCents };
  if (rothCents > balanceCents) {
    errors.roth = `The Roth portion can't be more than the balance (${formatCents(balanceCents)}).`;
    return { rothBps: null, rothCents };
  }
  if (balanceCents === 0) {
    errors.roth = "With a $0 balance, enter the Roth portion as a percentage.";
    return { rothBps: null, rothCents };
  }
  return {
    rothBps: largestRemainder(BPS_TOTAL, [balanceCents - rothCents, rothCents])[1],
    rothCents,
  };
}

export function evaluateDraft(
  draft: AccountDraft,
  assetClasses: AssetClass[],
): DraftEvaluation {
  const errors: DraftErrors = { fields: {} };
  const ids = assetClasses.map((c) => c.id);

  const name = draft.name.trim();
  if (!name) errors.name = "Give the account a name.";
  else if (name.length > 80) errors.name = "Keep the name under 80 characters.";

  let balanceCents: number | null = null;
  let bpsByClass: Record<string, number> = {};
  let centsByClass: Record<string, number> = {};

  if (draft.mode === "percent") {
    if (draft.balance.trim() === "") {
      errors.balance = "Enter the balance.";
    } else {
      balanceCents = parseDollarsToCents(draft.balance);
      if (balanceCents === null) errors.balance = "Enter a dollar amount like 12,500.00.";
      else if (balanceCents > MAX_BALANCE_CENTS) {
        errors.balance = "That balance is too large.";
        balanceCents = null;
      }
    }

    for (const id of ids) {
      const text = draft.percents[id]?.trim() ?? "";
      if (text === "") continue;
      const bps = parsePercentToBps(text);
      if (bps === null) errors.fields[id] = "Use 0–100 with up to 2 decimals.";
      else if (bps > 0) bpsByClass[id] = bps;
    }

    const remaining = remainingBps(bpsByClass);
    if (Object.keys(errors.fields).length === 0 && remaining !== 0) {
      errors.allocation =
        remaining > 0
          ? `Allocation adds up to ${formatBps(BPS_TOTAL - remaining)}; ${formatBps(remaining)} is unassigned.`
          : `Allocation adds up to ${formatBps(BPS_TOTAL - remaining)}; that's ${formatBps(-remaining)} too much.`;
    }

    if (balanceCents !== null) {
      const allocIds = Object.keys(bpsByClass);
      // Only split the balance when it's fully allocated; otherwise show the
      // dollars each entered percentage represents on its own.
      const cents =
        remaining === 0
          ? largestRemainder(balanceCents, allocIds.map((id) => bpsByClass[id]))
          : allocIds.map((id) =>
              Math.round((balanceCents! * bpsByClass[id]) / BPS_TOTAL),
            );
      centsByClass = Object.fromEntries(allocIds.map((id, i) => [id, cents[i]]));
    }

    const roth = evaluateRoth(draft, balanceCents, errors);
    const value =
      !hasErrors(errors) && balanceCents !== null
        ? withRoth(
            {
              name,
              type: draft.type,
              balanceCents,
              allocation: compactAllocation(bpsByClass),
            },
            roth.rothBps,
          )
        : null;
    return {
      balanceCents,
      bpsByClass,
      centsByClass,
      remainingBps: remaining,
      ...roth,
      errors,
      value,
    };
  }

  // Dollar mode: the balance is the sum of the amounts.
  for (const id of ids) {
    const text = draft.dollars[id]?.trim() ?? "";
    if (text === "") continue;
    const cents = parseDollarsToCents(text);
    if (cents === null) errors.fields[id] = "Enter a dollar amount.";
    else if (cents > 0) centsByClass[id] = cents;
  }
  const derived = allocationFromCents(centsByClass);
  if (derived) {
    balanceCents = derived.balanceCents;
    bpsByClass = derived.allocation;
    if (balanceCents > MAX_BALANCE_CENTS) errors.balance = "That balance is too large.";
  } else if (Object.keys(errors.fields).length === 0) {
    errors.allocation = "Enter at least one amount above $0.";
  }

  const roth = evaluateRoth(draft, balanceCents, errors);
  const value =
    !hasErrors(errors) && derived
      ? withRoth({ name, type: draft.type, ...derived }, roth.rothBps)
      : null;
  return {
    balanceCents,
    bpsByClass,
    centsByClass,
    remainingBps: derived ? 0 : BPS_TOTAL,
    ...roth,
    errors,
    value,
  };
}

function withRoth(fields: AccountFields, rothBps: number | null): AccountFields {
  return fields.type === "mixed" && rothBps !== null ? { ...fields, rothBps } : fields;
}

/** Switch the Roth portion between dollars and percent, converting when possible. */
export function switchRothUnit(
  draft: AccountDraft,
  assetClasses: AssetClass[],
  rothUnit: EntryMode,
): AccountDraft {
  if (draft.rothUnit === rothUnit) return draft;
  const { rothBps, rothCents, errors } = evaluateDraft(draft, assetClasses);
  if (errors.roth) return { ...draft, rothUnit };
  if (rothUnit === "dollars" && rothCents !== null) {
    return { ...draft, rothUnit, roth: centsToInput(rothCents) };
  }
  if (rothUnit === "percent" && rothBps !== null) {
    return { ...draft, rothUnit, roth: bpsToInput(rothBps) };
  }
  return { ...draft, rothUnit };
}

/**
 * Switch entry mode, converting the values when the current mode is valid.
 * Otherwise the other mode's previous text is kept as-is, so toggling back
 * and forth never destroys input.
 */
export function switchDraftMode(
  draft: AccountDraft,
  assetClasses: AssetClass[],
  mode: EntryMode,
): AccountDraft {
  if (draft.mode === mode) return draft;
  const evaluation = evaluateDraft(draft, assetClasses);
  const valid =
    evaluation.balanceCents !== null &&
    Object.keys(evaluation.errors.fields).length === 0 &&
    !evaluation.errors.allocation &&
    !evaluation.errors.balance;

  if (!valid) return { ...draft, mode };

  if (mode === "dollars") {
    return {
      ...draft,
      mode,
      dollars: Object.fromEntries(
        Object.entries(evaluation.centsByClass).map(([id, c]) => [id, centsToInput(c)]),
      ),
    };
  }
  return {
    ...draft,
    mode,
    balance: centsToInput(evaluation.balanceCents!),
    percents: Object.fromEntries(
      Object.entries(evaluation.bpsByClass).map(([id, bps]) => [id, bpsToInput(bps)]),
    ),
  };
}
