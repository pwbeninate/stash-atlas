import { taxBuckets, totalCents } from "@/lib/aggregate";
import { formatCents, formatPercent, roundedPercents } from "@/lib/money";
import {
  TAX_BUCKET_DESCRIPTIONS,
  TAX_BUCKET_LABELS,
  type PortfolioData,
} from "@/lib/schema";

export function SummaryCards({ data }: { data: PortfolioData }) {
  const total = totalCents(data.accounts);
  const buckets = taxBuckets(data);
  const percents = roundedPercents(buckets.map((b) => b.cents));
  const typeCount = new Set(data.accounts.map((a) => a.type)).size;
  const accountCount = data.accounts.length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
      <section className="col-span-2 flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-sm text-ink-2">Total portfolio</h2>
        <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          {formatCents(total, "whole")}
        </p>
        <p className="mt-3 text-sm text-ink-2">
          {accountCount} account{accountCount === 1 ? "" : "s"} across {typeCount} account type
          {typeCount === 1 ? "" : "s"}
        </p>
      </section>

      {buckets.map((bucket, i) => (
        <section
          key={bucket.key}
          className="flex flex-col rounded-2xl border border-line bg-surface p-4"
        >
          <h2 className="text-sm text-ink-2">{TAX_BUCKET_LABELS[bucket.key]}</h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {formatPercent(percents[i])}
          </p>
          <p className="text-sm text-ink-2">{formatCents(bucket.cents, "whole")}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div
              className="h-full rounded-full bg-accent-bg"
              style={{ width: `${bucket.share * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">{TAX_BUCKET_DESCRIPTIONS[bucket.key]}</p>
        </section>
      ))}
    </div>
  );
}
