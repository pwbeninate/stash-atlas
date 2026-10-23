"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/Card";
import { Swatch } from "@/components/ui/Swatch";
import { byAssetClass, totalCents } from "@/lib/aggregate";
import { formatCents, formatPercent, roundedPercents } from "@/lib/money";
import { seriesColor } from "@/lib/palette";
import type { PortfolioData } from "@/lib/schema";
import { ChartTooltip } from "./ChartTooltip";

interface Slice {
  id: string;
  name: string;
  colorIndex: number;
  cents: number;
  percent: number;
  fill: string;
}

export function AllocationDonut({ data }: { data: PortfolioData }) {
  const total = totalCents(data.accounts);
  const classes = new Map(data.assetClasses.map((c) => [c.id, c]));
  const held = byAssetClass(data).filter((s) => s.cents > 0);
  const percents = roundedPercents(held.map((s) => s.cents));
  const slices: Slice[] = held.map((s, i) => {
    const assetClass = classes.get(s.key)!;
    return {
      id: s.key,
      name: assetClass.name,
      colorIndex: assetClass.colorIndex,
      cents: s.cents,
      percent: percents[i],
      fill: seriesColor(assetClass.colorIndex),
    };
  });

  return (
    <Card title="Asset allocation" subtitle="What you own, across every account">
      {slices.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          Every account has a $0 balance, so there&apos;s nothing to chart yet.
        </p>
      ) : (
        <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,13rem)_1fr]">
          <div className="relative mx-auto aspect-square w-full max-w-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="cents"
                  nameKey="name"
                  innerRadius="66%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    const slice = payload?.[0]?.payload as Slice | undefined;
                    if (!active || !slice) return null;
                    return (
                      <ChartTooltip
                        title={slice.name}
                        rows={[
                          {
                            key: slice.id,
                            color: slice.fill,
                            label: formatPercent(slice.percent),
                            value: formatCents(slice.cents),
                          },
                        ]}
                      />
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-ink-2">Total</span>
              <span className="text-xl font-semibold tracking-tight">
                {formatCents(total, "compact")}
              </span>
            </div>
          </div>

          <table className="w-full text-sm">
            <caption className="sr-only">Asset allocation by asset class</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Asset class</th>
                <th scope="col">Value</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {slices.map((slice) => (
                <tr key={slice.id}>
                  <th scope="row" className="py-2 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <Swatch colorIndex={slice.colorIndex} />
                      <span className="truncate">{slice.name}</span>
                    </span>
                  </th>
                  <td className="py-2 pl-3 text-right whitespace-nowrap tabular-nums text-ink-2">
                    {formatCents(slice.cents, "whole")}
                  </td>
                  <td className="w-16 py-2 pl-3 text-right font-medium tabular-nums">
                    {formatPercent(slice.percent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
