"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AccountDialog } from "@/components/accounts/AccountDialog";
import { AccountTable } from "@/components/dashboard/AccountTable";
import { AllocationDonut } from "@/components/dashboard/AllocationDonut";
import { LocationMatrix } from "@/components/dashboard/LocationMatrix";
import { LocationStackedBar } from "@/components/dashboard/LocationStackedBar";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { EmptyState } from "@/components/EmptyState";
import { AssetClassDialog } from "@/components/settings/AssetClassDialog";
import { DataMenu } from "@/components/settings/DataMenu";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { PlusIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { samplePortfolio } from "@/lib/defaults";
import { deleteAccount } from "@/lib/ops";
import type { Account, PortfolioData } from "@/lib/schema";
import { exportFileName, parsePortfolioJson, serializePortfolio } from "@/lib/storage";
import {
  resetPortfolio,
  setPortfolio,
  updatePortfolio,
  usePortfolio,
} from "@/state/portfolio-store";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

interface Confirm {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
}

type Modal =
  | { kind: "account"; account: Account | null; template?: Account }
  | { kind: "assetClasses" }
  | { kind: "confirm"; confirm: Confirm }
  | { kind: "importError"; fileName: string; errors: string[] }
  | null;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function downloadExport(data: PortfolioData) {
  const blob = new Blob([serializePortfolio(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName();
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function Dashboard() {
  const snapshot = usePortfolio();
  const [modal, setModal] = useState<Modal>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const close = () => setModal(null);

  if (snapshot.status === "loading") {
    return (
      <Shell>
        <div className="h-64" aria-busy="true" aria-label="Loading your portfolio" />
      </Shell>
    );
  }

  const { data } = snapshot;
  const hasAccounts = data.accounts.length > 0;
  const confirm = (c: Confirm) => setModal({ kind: "confirm", confirm: c });

  /** Replace everything, asking first if that would discard existing accounts. */
  function replaceWith(next: PortfolioData, source: string) {
    if (!hasAccounts) {
      setPortfolio(next);
      return;
    }
    confirm({
      title: "Replace your data?",
      description: `This replaces your ${plural(data.accounts.length, "account")} with ${plural(next.accounts.length, "account")} from ${source}. Export first if you want a backup.`,
      confirmLabel: "Replace",
      onConfirm: () => setPortfolio(next),
    });
  }

  async function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setModal({ kind: "importError", fileName: file.name, errors: ["That file is larger than 5 MB, which is far more than a Stash Atlas export."] });
      return;
    }
    const result = parsePortfolioJson(await file.text());
    if (!result.ok) {
      setModal({ kind: "importError", fileName: file.name, errors: result.errors });
      return;
    }
    replaceWith(result.data, `"${file.name}"`);
  }

  const addAccount = () => setModal({ kind: "account", account: null });

  return (
    <Shell
      actions={
        <>
          <DataMenu
            items={[
              { label: "Asset classes…", onSelect: () => setModal({ kind: "assetClasses" }) },
              { label: "Export JSON", onSelect: () => downloadExport(data), separatorBefore: true },
              { label: "Import JSON…", onSelect: () => fileInputRef.current?.click() },
              { label: "Load sample data", onSelect: () => replaceWith(samplePortfolio(), "the sample portfolio") },
              {
                label: "Clear all data…",
                tone: "danger",
                separatorBefore: true,
                onSelect: () =>
                  confirm({
                    title: "Clear all data?",
                    description: `This permanently removes ${plural(data.accounts.length, "account")} and any custom asset classes from this browser. Export first if you might want them back.`,
                    confirmLabel: "Clear everything",
                    tone: "danger",
                    onConfirm: resetPortfolio,
                  }),
              },
            ]}
          />
          {hasAccounts && (
            <Button variant="primary" onClick={addAccount} aria-label="Add account">
              <PlusIcon /> <span className="hidden sm:inline">Add account</span>
            </Button>
          )}
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFile}
        aria-hidden="true"
        tabIndex={-1}
      />

      {(snapshot.loadErrors || snapshot.saveError) && (
        <div role="alert" className="mb-6 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {snapshot.saveError ??
            "Your saved data couldn't be read, so Stash Atlas started fresh. A copy of the unreadable data was kept in this browser's storage."}
        </div>
      )}

      {hasAccounts ? (
        <div className="space-y-6">
          <SummaryCards data={data} />
          <div className="grid gap-6 lg:grid-cols-2">
            <AllocationDonut data={data} />
            <LocationStackedBar data={data} />
          </div>
          <LocationMatrix data={data} />
          <AccountTable
            data={data}
            onEdit={(account) => setModal({ kind: "account", account })}
            onDuplicate={(template) => setModal({ kind: "account", account: null, template })}
            onDelete={(account) =>
              confirm({
                title: "Delete account?",
                description: `"${account.name}" will be removed from this browser. This can't be undone unless you have an export.`,
                confirmLabel: "Delete account",
                tone: "danger",
                onConfirm: () => updatePortfolio((d) => deleteAccount(d, account.id)),
              })
            }
          />
        </div>
      ) : (
        <EmptyState onAddAccount={addAccount} onLoadSample={() => setPortfolio(samplePortfolio())} />
      )}

      <AccountDialog
        open={modal?.kind === "account"}
        account={modal?.kind === "account" ? modal.account : null}
        template={modal?.kind === "account" ? (modal.template ?? null) : null}
        data={data}
        onClose={close}
      />
      <AssetClassDialog open={modal?.kind === "assetClasses"} data={data} onClose={close} />
      <ConfirmDialog
        open={modal?.kind === "confirm"}
        title={modal?.kind === "confirm" ? modal.confirm.title : ""}
        description={modal?.kind === "confirm" ? modal.confirm.description : ""}
        confirmLabel={modal?.kind === "confirm" ? modal.confirm.confirmLabel : ""}
        tone={modal?.kind === "confirm" ? modal.confirm.tone : undefined}
        onConfirm={() => {
          if (modal?.kind === "confirm") modal.confirm.onConfirm();
        }}
        onClose={close}
      />
      <Dialog
        open={modal?.kind === "importError"}
        onClose={close}
        title="Couldn't import that file"
        description={
          modal?.kind === "importError"
            ? `"${modal.fileName}" isn't a valid Stash Atlas export. Nothing was changed.`
            : undefined
        }
        size="sm"
        footer={
          <Button variant="primary" onClick={close}>
            OK
          </Button>
        }
      >
        {modal?.kind === "importError" && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {modal.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </Dialog>
    </Shell>
  );
}

function Shell({ actions, children }: { actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-page/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo />
            <h1 className="truncate text-base font-semibold tracking-tight">Stash Atlas</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-muted sm:px-6">
        Your data stays in this browser&apos;s local storage. Stash Atlas is informational only
        and isn&apos;t tax or investment advice.
      </footer>
    </>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent-bg)" />
      <rect x="7" y="7" width="8" height="8" rx="1.5" fill="var(--accent-fg)" />
      <rect x="17" y="7" width="8" height="8" rx="1.5" fill="var(--accent-fg)" opacity="0.6" />
      <rect x="7" y="17" width="8" height="8" rx="1.5" fill="var(--accent-fg)" opacity="0.6" />
      <rect x="17" y="17" width="8" height="8" rx="1.5" fill="var(--accent-fg)" opacity="0.3" />
    </svg>
  );
}
