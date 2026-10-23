import { formatBps } from "@/lib/money";
import { seriesColor } from "@/lib/palette";
import type { Account, AssetClass } from "@/lib/schema";

/** One account's allocation as a thin segmented bar, in asset class order. */
export function MiniAllocationBar({
  account,
  assetClasses,
}: {
  account: Account;
  assetClasses: AssetClass[];
}) {
  const segments = assetClasses
    .map((c) => ({ assetClass: c, bps: account.allocation[c.id] ?? 0 }))
    .filter((s) => s.bps > 0);
  const description = segments
    .map((s) => `${s.assetClass.name} ${formatBps(s.bps)}`)
    .join(", ");

  return (
    <div className="flex h-2 w-full min-w-24 gap-0.5 overflow-hidden rounded-full" title={description}>
      <span className="sr-only">{description}</span>
      {segments.map(({ assetClass, bps }) => (
        <span
          key={assetClass.id}
          aria-hidden="true"
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ width: `${bps / 100}%`, backgroundColor: seriesColor(assetClass.colorIndex) }}
        />
      ))}
    </div>
  );
}
