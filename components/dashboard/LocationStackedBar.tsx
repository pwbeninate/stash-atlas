"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Swatch } from "@/components/ui/Swatch";
import { byAccountType, byAssetClass } from "@/lib/aggregate";
import { formatCents, formatPercent, ratio, roundedPercents } from "@/lib/money";
import { seriesColor } from "@/lib/palette";
import { niceTicks } from "@/lib/scale";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_SHORT_LABELS,
  type AccountType,
  type PortfolioData,
} from "@/lib/schema";
import { ChartTooltip } from "./ChartTooltip";

type Mode = "dollars" | "percent";

interface Row {
  type: AccountType;
  label: string;
  cents: number;
  byClass: Record<string, number>;
  [classId: string]: number | string | Record<string, number>;
}

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function LocationStackedBar({ data }: { data: PortfolioData }) {
  const [mode, setMode] = useState<Mode>("dollars");
  const classesById = new Map(data.assetClasses.map((c) => [c.id, c]));
  const held = byAssetClass(data)
    .filter((c) => c.cents > 0)
    .map((c) => classesById.get(c.key)!);
  const types = byAccountType(data).filter((t) => t.cents > 0);

  const rows: Row[] = types.map((t) => {
    const row: Row = {
      type: t.key,
      label: ACCOUNT_TYPE_SHORT_LABELS[t.key],
      cents: t.cents,
      byClass: t.byClass,
    };
    for (const c of held) {
      const cents = t.byClass[c.id] ?? 0;
      row[c.id] = mode === "dollars" ? cents / 100 : ratio(cents, t.cents) * 100;
    }
    return row;
  });

  const ticks =
    mode === "percent"
      ? [0, 25, 50, 75, 100]
      : niceTicks(Math.max(0, ...types.map((t) => t.cents)) / 100);

  return (
    <Card
      title="Asset location"
      subtitle="How each account type is invested"
      actions={
        <Segmented<Mode>
          label="Show bars as"
          value={mode}
          options={[
            { value: "dollars", label: "$" },
            { value: "percent", label: "%" },
          ]}
          onChange={setMode}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Nothing to chart yet.</p>
      ) : (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
            {held.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5">
                <Swatch colorIndex={c.colorIndex} />
                {c.name}
              </li>
            ))}
          </ul>
          <div style={{ height: rows.length * 44 + 36 }} role="img" aria-label="Stacked bar chart of asset classes by account type. The location matrix below lists the same values.">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke="var(--line)" />
                <XAxis
                  type="number"
                  domain={[0, ticks[ticks.length - 1]]}
                  ticks={ticks}
                  interval={0}
                  tickFormatter={(v: number) =>
                    mode === "percent" ? `${v}%` : compactUsd.format(v)
                  }
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={84}
                  tick={{ fill: "var(--ink-2)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--line-strong)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as Row | undefined;
                    if (!active || !row) return null;
                    const present = held.filter((c) => (row.byClass[c.id] ?? 0) > 0);
                    const pcts = roundedPercents(present.map((c) => row.byClass[c.id]));
                    return (
                      <ChartTooltip
                        title={ACCOUNT_TYPE_LABELS[row.type]}
                        subtitle={formatCents(row.cents)}
                        rows={present.map((c, i) => ({
                          key: c.id,
                          color: seriesColor(c.colorIndex),
                          label: c.name,
                          value: formatCents(row.byClass[c.id], "whole"),
                          detail: formatPercent(pcts[i]),
                        }))}
                      />
                    );
                  }}
                />
                {held.map((c) => (
                  <Bar
                    key={c.id}
                    dataKey={c.id}
                    name={c.name}
                    stackId="location"
                    fill={seriesColor(c.colorIndex)}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
