"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PencilIcon, SortIcon, TrashIcon } from "@/components/ui/icons";
import { formatCents, formatPercent, ratio } from "@/lib/money";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type PortfolioData,
} from "@/lib/schema";
import { totalCents } from "@/lib/aggregate";
import { MiniAllocationBar } from "./MiniAllocationBar";

type SortKey = "name" | "type" | "balance";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const collator = new Intl.Collator("en-US", { sensitivity: "base", numeric: true });

function compare(a: Account, b: Account, key: SortKey): number {
  switch (key) {
    case "name":
      return collator.compare(a.name, b.name);
    case "type":
      return (
        ACCOUNT_TYPES.indexOf(a.type) - ACCOUNT_TYPES.indexOf(b.type) ||
        collator.compare(a.name, b.name)
      );
    case "balance":
      return a.balanceCents - b.balanceCents || collator.compare(a.name, b.name);
  }
}

export function AccountTable({
  data,
  onEdit,
  onDelete,
}: {
  data: PortfolioData;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const [sort, setSort] = useState<Sort>({ key: "balance", dir: "desc" });
  const total = totalCents(data.accounts);

  const rows = useMemo(() => {
    const sorted = [...data.accounts].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [data.accounts, sort]);

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "balance" ? "desc" : "asc" },
    );
  }

  function header(key: SortKey, label: string, align: "left" | "right" = "left") {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          className={`inline-flex items-center gap-1 rounded hover:text-ink ${active ? "text-ink" : ""}`}
        >
          {label}
          <SortIcon sortDirection={active ? sort.dir : null} className={active ? "" : "opacity-50"} />
        </button>
      </th>
    );
  }

  return (
    <Card
      title="Accounts"
      subtitle={`${data.accounts.length} account${data.accounts.length === 1 ? "" : "s"}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-b border-line text-xs text-ink-2">
            <tr>
              {header("name", "Name")}
              {header("type", "Type")}
              {header("balance", "Balance", "right")}
              <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">
                Share
              </th>
              <th scope="col" className="w-1/4 px-3 py-2 text-left font-medium">
                Allocation
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((account) => (
              <tr key={account.id} className="hover:bg-surface-2/60">
                <th scope="row" className="max-w-48 truncate px-3 py-2.5 text-left font-medium">
                  {account.name}
                </th>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">
                  {ACCOUNT_TYPE_LABELS[account.type]}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                  {formatCents(account.balanceCents)}
                </td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-ink-2 md:table-cell">
                  {formatPercent(ratio(account.balanceCents, total) * 100)}
                </td>
                <td className="px-3 py-2.5">
                  <MiniAllocationBar account={account} assetClasses={data.assetClasses} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(account)}
                      aria-label={`Edit ${account.name}`}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(account)}
                      aria-label={`Delete ${account.name}`}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-danger"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
