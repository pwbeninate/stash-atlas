"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Swatch } from "@/components/ui/Swatch";
import { TrashIcon } from "@/components/ui/icons";
import {
  accountsUsingClass,
  addAssetClass,
  deleteAssetClass,
  renameAssetClass,
  type OpResult,
} from "@/lib/ops";
import type { PortfolioData } from "@/lib/schema";
import { setPortfolio } from "@/state/portfolio-store";

export function AssetClassDialog({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: PortfolioData;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Asset classes"
      description="Rename the defaults or add your own. A class can be removed once no account holds it."
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <AssetClassEditor data={data} />
    </Dialog>
  );
}

function AssetClassEditor({ data }: { data: PortfolioData }) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply(result: OpResult) {
    if (result.ok) {
      setPortfolio(result.data);
      setError(null);
      return true;
    }
    setError(result.error);
    return false;
  }

  function onAdd(event: FormEvent) {
    event.preventDefault();
    if (apply(addAssetClass(data, newName))) setNewName("");
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {data.assetClasses.map((assetClass) => {
          const users = accountsUsingClass(data, assetClass.id).length;
          return (
            <li key={assetClass.id} className="flex items-center gap-3 px-3 py-2">
              <Swatch colorIndex={assetClass.colorIndex} />
              <input
                aria-label={`Name for ${assetClass.name}`}
                defaultValue={assetClass.name}
                maxLength={40}
                onBlur={(e) => {
                  if (e.target.value.trim() === assetClass.name) return;
                  if (!apply(renameAssetClass(data, assetClass.id, e.target.value))) {
                    e.target.value = assetClass.name;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm hover:border-line focus:border-line-strong"
              />
              <span className="hidden text-xs text-muted sm:inline">
                {users === 0 ? "Unused" : `${users} account${users === 1 ? "" : "s"}`}
              </span>
              <button
                type="button"
                onClick={() => apply(deleteAssetClass(data, assetClass.id))}
                aria-label={`Remove ${assetClass.name}`}
                title={users ? "Held by an account" : "Remove"}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-danger"
              >
                <TrashIcon />
              </button>
            </li>
          );
        })}
      </ul>

      <form onSubmit={onAdd} className="flex gap-2">
        <label htmlFor="new-asset-class" className="sr-only">
          New asset class name
        </label>
        <input
          id="new-asset-class"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
          placeholder="e.g. TIPS, Gold, Private equity"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm"
        />
        <Button type="submit" disabled={!newName.trim()}>
          Add class
        </Button>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
