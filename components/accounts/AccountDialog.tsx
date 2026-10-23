"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Segmented } from "@/components/ui/Segmented";
import {
  draftFromAccount,
  emptyDraft,
  evaluateDraft,
  switchDraftMode,
  type AccountDraft,
  type EntryMode,
} from "@/lib/draft";
import { addAccount, updateAccount } from "@/lib/ops";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type AccountType,
  type PortfolioData,
} from "@/lib/schema";
import { parsePortfolio } from "@/lib/storage";
import { setPortfolio } from "@/state/portfolio-store";
import { AllocationInput } from "./AllocationInput";

const FORM_ID = "account-form";

export function AccountDialog({
  open,
  account,
  data,
  onClose,
}: {
  open: boolean;
  /** Present when editing. */
  account: Account | null;
  data: PortfolioData;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={account ? "Edit account" : "Add account"}
      description="Enter the balance and how it's invested. Don't include account numbers."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form={FORM_ID}>
            {account ? "Save changes" : "Add account"}
          </Button>
        </>
      }
    >
      <AccountForm account={account} data={data} onDone={onClose} />
    </Dialog>
  );
}

function AccountForm({
  account,
  data,
  onDone,
}: {
  account: Account | null;
  data: PortfolioData;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<AccountDraft>(() =>
    account ? draftFromAccount(account) : emptyDraft(),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const evaluation = useMemo(
    () => evaluateDraft(draft, data.assetClasses),
    [draft, data.assetClasses],
  );
  const { errors } = evaluation;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!evaluation.value) {
      setShowErrors(true);
      return;
    }
    const next = account
      ? updateAccount(data, account.id, evaluation.value)
      : addAccount(data, evaluation.value);
    // Final guard: never persist anything the stored schema would reject.
    const checked = parsePortfolio(next);
    if (!checked.ok) {
      setSaveError(checked.errors.join(" "));
      return;
    }
    setPortfolio(checked.data);
    onDone();
  }

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account name" htmlFor="account-name" error={showErrors ? errors.name : undefined}>
          <input
            id="account-name"
            autoFocus
            autoComplete="off"
            maxLength={80}
            placeholder="e.g. Fidelity Roth IRA"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            aria-invalid={showErrors && Boolean(errors.name)}
            className={inputClass(showErrors && Boolean(errors.name))}
          />
        </Field>
        <Field label="Account type" htmlFor="account-type">
          <select
            id="account-type"
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value as AccountType })}
            className={inputClass(false)}
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACCOUNT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {draft.mode === "percent" ? (
          <Field
            label="Total balance"
            htmlFor="account-balance"
            error={showErrors ? errors.balance : undefined}
            className="w-full sm:w-64"
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
                $
              </span>
              <input
                id="account-balance"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={draft.balance}
                onChange={(e) => setDraft({ ...draft, balance: e.target.value })}
                aria-invalid={showErrors && Boolean(errors.balance)}
                className={`${inputClass(showErrors && Boolean(errors.balance))} pl-7 tabular-nums`}
              />
            </div>
          </Field>
        ) : (
          <p className="text-sm text-ink-2">
            In dollar mode, the balance is the total of the amounts below.
          </p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-2">
            Enter as
          </span>
          <Segmented<EntryMode>
            label="Enter allocation as"
            value={draft.mode}
            options={[
              { value: "percent", label: "Percent" },
              { value: "dollars", label: "Dollars" },
            ]}
            onChange={(mode) => setDraft(switchDraftMode(draft, data.assetClasses, mode))}
          />
        </div>
      </div>

      <AllocationInput
        draft={draft}
        evaluation={evaluation}
        assetClasses={data.assetClasses}
        showErrors={showErrors}
        onChange={(id, text) =>
          setDraft(
            draft.mode === "percent"
              ? { ...draft, percents: { ...draft.percents, [id]: text } }
              : { ...draft, dollars: { ...draft.dollars, [id]: text } },
          )
        }
      />

      {showErrors && !evaluation.value && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errors.allocation && draft.mode === "percent"
            ? errors.allocation
            : "Fix the highlighted fields to save this account."}
        </p>
      )}
      {saveError && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {saveError}
        </p>
      )}
    </form>
  );
}

function inputClass(invalid: boolean) {
  return `h-10 w-full rounded-lg border bg-surface px-3 text-sm ${
    invalid ? "border-danger" : "border-line-strong"
  }`;
}

function Field({
  label,
  htmlFor,
  error,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
