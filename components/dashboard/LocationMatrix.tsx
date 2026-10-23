"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Swatch } from "@/components/ui/Swatch";
import { locationMatrix, type MatrixCell } from "@/lib/aggregate";
import { formatCents, formatPercent, roundedPercents } from "@/lib/money";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_SHORT_LABELS,
  type PortfolioData,
} from "@/lib/schema";

/** row: where each asset class lives. col: what each account type holds. */
type Norm = "row" | "col";

const EXPLAIN: Record<Norm, string> = {
  row: "Each row shows where an asset class is held. Rows add up to 100%.",
  col: "Each column shows what an account type holds. Columns add up to 100%.",
};

function heatStyle(share: number): React.CSSProperties | undefined {
  if (share <= 0) return undefined;
  // Single-hue sequential ramp: the active share mixes the heat color into
  // the surface, capped so text keeps its contrast in both themes.
  return {
    backgroundColor: `color-mix(in oklab, var(--heat) calc(var(--heat-max) * ${share.toFixed(4)}), var(--surface))`,
  };
}

export function LocationMatrix({ data }: { data: PortfolioData }) {
  const [norm, setNorm] = useState<Norm>("row");
  const [hover, setHover] = useState<{ row: string; col: string } | null>(null);
  const matrix = locationMatrix(data);
  const classesById = new Map(data.assetClasses.map((c) => [c.id, c]));
  const { rows, columns } = matrix;

  // Display percentages that add up to exactly 100 along the active direction.
  const rowPercents = new Map(
    rows.map((r) => [r.assetClassId, roundedPercents(columns.map((c) => r.cells[c.type].cents))]),
  );
  const colPercents = new Map(
    columns.map((c) => [c.type, roundedPercents(rows.map((r) => r.cells[c.type].cents))]),
  );
  const classShare = roundedPercents(rows.map((r) => r.cents));
  const typeShare = roundedPercents(columns.map((c) => c.cents));

  function display(rowIndex: number, colIndex: number, cell: MatrixCell) {
    return norm === "row"
      ? { share: cell.rowShare, percent: rowPercents.get(rows[rowIndex].assetClassId)![colIndex] }
      : { share: cell.colShare, percent: colPercents.get(columns[colIndex].type)![rowIndex] };
  }

  return (
    <Card
      title="Location matrix"
      subtitle="Asset class × account type"
      actions={
        <Segmented<Norm>
          label="Percentages relative to"
          value={norm}
          options={[
            { value: "row", label: "% of asset class" },
            { value: "col", label: "% of account type" },
          ]}
          onChange={setNorm}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Nothing to show yet.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="text-sm text-ink-2">{EXPLAIN[norm]}</p>
            <div className="flex items-center gap-2 text-xs text-muted" aria-hidden="true">
              <span>0%</span>
              <span
                className="h-2 w-24 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, var(--surface-2), color-mix(in oklab, var(--heat) var(--heat-max), var(--surface)))",
                }}
              />
              <span>100%</span>
            </div>
          </div>

          <div className="relative overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-sm" onMouseLeave={() => setHover(null)}>
              <caption className="sr-only">
                Dollar value and percentage of each asset class held in each account type. {EXPLAIN[norm]}
              </caption>
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-xs">
                  <th scope="col" className="sticky left-0 z-[1] bg-surface-2 px-3 py-2.5 text-left font-medium text-ink-2">
                    Asset class
                  </th>
                  {columns.map((col, ci) => (
                    <th
                      key={col.type}
                      scope="col"
                      className={`min-w-24 px-3 py-2.5 text-right font-medium transition-colors ${
                        hover?.col === col.type ? "text-ink" : "text-ink-2"
                      }`}
                    >
                      <abbr title={ACCOUNT_TYPE_LABELS[col.type]} className="no-underline">
                        {ACCOUNT_TYPE_SHORT_LABELS[col.type]}
                      </abbr>
                      <span className="block font-normal text-muted">
                        {formatPercent(typeShare[ci])} of total
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="min-w-28 border-l border-line px-3 py-2.5 text-right font-medium text-ink-2">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const assetClass = classesById.get(row.assetClassId)!;
                  const rowHovered = hover?.row === row.assetClassId;
                  return (
                    <tr key={row.assetClassId} className="border-b border-line last:border-b-0">
                      <th
                        scope="row"
                        className={`sticky left-0 z-[1] w-32 bg-surface px-3 py-2 text-left font-medium transition-colors sm:w-auto sm:whitespace-nowrap ${
                          rowHovered ? "text-ink" : ""
                        }`}
                      >
                        <span className="flex items-center gap-2 leading-snug">
                          <Swatch colorIndex={assetClass.colorIndex} />
                          {assetClass.name}
                        </span>
                      </th>
                      {columns.map((col, ci) => {
                        const cell = row.cells[col.type];
                        const { share, percent } = display(ri, ci, cell);
                        const typeLabel = ACCOUNT_TYPE_LABELS[col.type];
                        const description =
                          cell.cents === 0
                            ? `No ${assetClass.name} in ${typeLabel} accounts`
                            : norm === "row"
                              ? `${formatPercent(percent)} of your ${assetClass.name} is in ${typeLabel} accounts (${formatCents(cell.cents)})`
                              : `${formatPercent(percent)} of your ${typeLabel} accounts is ${assetClass.name} (${formatCents(cell.cents)})`;
                        const highlighted = rowHovered || hover?.col === col.type;
                        return (
                          <td
                            key={col.type}
                            title={description}
                            onMouseEnter={() => setHover({ row: row.assetClassId, col: col.type })}
                            className={`px-3 py-2 text-right tabular-nums transition-shadow ${
                              highlighted ? "shadow-[inset_0_0_0_1px_var(--line-strong)]" : ""
                            }`}
                            style={heatStyle(share)}
                          >
                            <span className="sr-only">{description}</span>
                            {cell.cents === 0 ? (
                              <span aria-hidden="true" className="text-muted">
                                –
                              </span>
                            ) : (
                              <span aria-hidden="true">
                                <span className="block font-medium">{formatPercent(percent)}</span>
                                <span className="block text-xs">
                                  {formatCents(cell.cents, "whole")}
                                </span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-l border-line px-3 py-2 text-right tabular-nums">
                        <span className="block font-medium">{formatCents(row.cents, "whole")}</span>
                        <span className="block text-xs text-muted">
                          {formatPercent(classShare[ri])} of total
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong bg-surface-2/60">
                  <th scope="row" className="sticky left-0 z-[1] bg-surface-2 px-3 py-2.5 text-left font-medium">
                    Total
                  </th>
                  {columns.map((col) => (
                    <td key={col.type} className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {formatCents(col.cents, "whole")}
                    </td>
                  ))}
                  <td className="border-l border-line px-3 py-2.5 text-right font-semibold tabular-nums">
                    {formatCents(matrix.totalCents, "whole")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
