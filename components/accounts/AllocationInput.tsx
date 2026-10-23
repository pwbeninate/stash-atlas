"use client";

import { Swatch } from "@/components/ui/Swatch";
import type { AccountDraft, DraftEvaluation } from "@/lib/draft";
import { formatBps, formatCents } from "@/lib/money";
import { BPS_TOTAL, type AssetClass } from "@/lib/schema";

/** Per-asset-class inputs plus the live "remaining" indicator. */
export function AllocationInput({
  draft,
  evaluation,
  assetClasses,
  showErrors,
  onChange,
}: {
  draft: AccountDraft;
  evaluation: DraftEvaluation;
  assetClasses: AssetClass[];
  showErrors: boolean;
  onChange: (id: string, text: string) => void;
}) {
  const percentMode = draft.mode === "percent";
  const values = percentMode ? draft.percents : draft.dollars;

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        Allocation {percentMode ? "(%)" : "($)"}
      </legend>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {assetClasses.map((assetClass) => {
          const inputId = `alloc-${assetClass.id}`;
          const error = evaluation.errors.fields[assetClass.id];
          const hint = percentMode
            ? evaluation.centsByClass[assetClass.id] !== undefined
              ? formatCents(evaluation.centsByClass[assetClass.id])
              : null
            : evaluation.bpsByClass[assetClass.id] !== undefined
              ? formatBps(evaluation.bpsByClass[assetClass.id])
              : null;
          return (
            <li key={assetClass.id} className="px-3 py-2">
              <div className="flex items-center gap-3">
                <label htmlFor={inputId} className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <Swatch colorIndex={assetClass.colorIndex} />
                  <span className="truncate">{assetClass.name}</span>
                </label>
                <span className="hidden w-28 text-right text-xs tabular-nums text-muted sm:inline">
                  {hint}
                </span>
                <div className="relative w-32 shrink-0">
                  {!percentMode && (
                    <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted">
                      $
                    </span>
                  )}
                  <input
                    id={inputId}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={values[assetClass.id] ?? ""}
                    onChange={(e) => onChange(assetClass.id, e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    className={`h-9 w-full rounded-lg border bg-surface text-right text-sm tabular-nums ${
                      percentMode ? "pr-7 pl-2.5" : "pr-2.5 pl-6"
                    } ${error ? "border-danger" : "border-line-strong"}`}
                  />
                  {percentMode && (
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-muted">
                      %
                    </span>
                  )}
                </div>
              </div>
              {hint && <p className="mt-1 text-right text-xs text-muted sm:hidden">{hint}</p>}
              {error && (
                <p id={`${inputId}-error`} className="mt-1 text-right text-xs text-danger">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <RemainingIndicator
        draft={draft}
        evaluation={evaluation}
        showErrors={showErrors}
      />
    </fieldset>
  );
}

function RemainingIndicator({
  draft,
  evaluation,
  showErrors,
}: {
  draft: AccountDraft;
  evaluation: DraftEvaluation;
  showErrors: boolean;
}) {
  const remaining = evaluation.remainingBps;
  const allocated = BPS_TOTAL - remaining;
  const complete = remaining === 0 && !evaluation.errors.allocation;
  const over = remaining < 0;

  let message: string;
  if (draft.mode === "dollars") {
    message =
      evaluation.balanceCents !== null
        ? `Balance from amounts: ${formatCents(evaluation.balanceCents)}`
        : "Enter amounts for each asset class.";
  } else if (complete) {
    message = "100% allocated";
  } else if (over) {
    message = `Over by ${formatBps(-remaining)}`;
  } else {
    message = `${formatBps(remaining)} remaining`;
  }

  const tone =
    over || (showErrors && !complete) ? "text-danger" : complete ? "text-success" : "text-ink-2";

  return (
    <div className="mt-3" aria-live="polite">
      {draft.mode === "percent" && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Allocated"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(allocated, BPS_TOTAL) / 100}
        >
          <div
            className={`h-full rounded-full ${over ? "bg-danger-bg" : complete ? "bg-success" : "bg-accent-bg"}`}
            style={{ width: `${Math.min(Math.max(allocated, 0), BPS_TOTAL) / 100}%` }}
          />
        </div>
      )}
      <p className={`mt-1.5 text-sm font-medium ${tone}`}>{message}</p>
      {showErrors && evaluation.errors.allocation && draft.mode === "dollars" && (
        <p className="mt-1 text-sm text-danger">{evaluation.errors.allocation}</p>
      )}
    </div>
  );
}
