"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CopyIcon, PencilIcon, SortIcon, TrashIcon } from "@/components/ui/icons";
import { formatBps, formatCents, formatPercent, ratio } from "@/lib/money";
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

/** "Traditional + Roth" accounts also show their Roth share. */
function TypeLabel({ account }: { account: Account }) {
  return (
    <>
      {ACCOUNT_TYPE_LABELS[account.type]}
      {account.type === "mixed" && account.rothBps !== undefined && (
        <span className="block text-xs text-muted">{formatBps(account.rothBps)} Roth</span>
      )}
    </>
  );
}

const ICON_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2";

function RowActions({
  account,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  account: Account;
  onEdit: (account: Account) => void;
  onDuplicate: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  return (
    <span className="flex gap-1 sm:justify-end">
      <button
        type="button"
        onClick={() => onEdit(account)}
        aria-label={`Edit ${account.name}`}
        title="Edit"
        className={`${ICON_BUTTON} hover:text-ink`}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        onClick={() => onDuplicate(account)}
        aria-label={`Duplicate ${account.name}`}
        title="Duplicate"
        className={`${ICON_BUTTON} hover:text-ink`}
      >
        <CopyIcon />
      </button>
      <button
        type="button"
        onClick={() => onDelete(account)}
        aria-label={`Delete ${account.name}`}
        title="Delete"
        className={`${ICON_BUTTON} hover:text-danger`}
      >
        <TrashIcon />
      </button>
    </span>
  );
}

export function AccountTable({
  data,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  data: PortfolioData;
  onEdit: (account: Account) => void;
  onDuplicate: (account: Account) => void;
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

  function header(key: SortKey, label: string, className = "text-left") {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={`px-3 py-2 font-medium ${className}`}
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
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-xs text-ink-2">
            <tr>
              {header("name", "Name")}
              {header("type", "Type", "hidden text-left sm:table-cell")}
              {header("balance", "Balance", "text-right")}
              <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">
                Share
              </th>
              <th scope="col" className="hidden w-1/4 px-3 py-2 text-left font-medium sm:table-cell">
                Allocation
              </th>
              <th scope="col" className="hidden px-3 py-2 sm:table-cell">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((account) => (
              <tr key={account.id} className="hover:bg-surface-2/60">
                <th scope="row" className="px-3 py-2.5 text-left font-medium">
                  <span className="line-clamp-2 break-words sm:max-w-56">{account.name}</span>
                  {/* On phones, type, allocation, and actions stack under the name. */}
                  <span className="mt-0.5 block text-xs font-normal text-ink-2 sm:hidden">
                    <TypeLabel account={account} />
                  </span>
                  <span className="mt-2 block sm:hidden">
                    <MiniAllocationBar account={account} assetClasses={data.assetClasses} />
                  </span>
                  <span className="mt-1.5 -ml-2 block sm:hidden">
                    <RowActions
                      account={account}
                      onEdit={onEdit}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                    />
                  </span>
                </th>
                <td className="hidden px-3 py-2.5 text-ink-2 sm:table-cell">
                  <TypeLabel account={account} />
                </td>
                <td className="px-3 py-2.5 text-right align-top whitespace-nowrap tabular-nums sm:align-middle">
                  {formatCents(account.balanceCents)}
                </td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-ink-2 md:table-cell">
                  {formatPercent(ratio(account.balanceCents, total) * 100)}
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <MiniAllocationBar account={account} assetClasses={data.assetClasses} />
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <RowActions
                    account={account}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
