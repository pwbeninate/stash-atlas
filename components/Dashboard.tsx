"use client";

import { useState } from "react";
import { AccountDialog } from "@/components/accounts/AccountDialog";
import { AccountTable } from "@/components/dashboard/AccountTable";
import { EmptyState } from "@/components/EmptyState";
import { AssetClassDialog } from "@/components/settings/AssetClassDialog";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PlusIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { samplePortfolio } from "@/lib/defaults";
import { deleteAccount } from "@/lib/ops";
import type { Account } from "@/lib/schema";
import { setPortfolio, updatePortfolio, usePortfolio } from "@/state/portfolio-store";

type Modal =
  | { kind: "account"; account: Account | null }
  | { kind: "assetClasses" }
  | { kind: "deleteAccount"; account: Account }
  | null;

export function Dashboard() {
  const snapshot = usePortfolio();
  const [modal, setModal] = useState<Modal>(null);
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

  return (
    <Shell
      actions={
        <>
          <Button variant="ghost" onClick={() => setModal({ kind: "assetClasses" })}>
            Asset classes
          </Button>
          {hasAccounts && (
            <Button variant="primary" onClick={() => setModal({ kind: "account", account: null })}>
              <PlusIcon /> <span>Add account</span>
            </Button>
          )}
        </>
      }
    >
      {(snapshot.loadErrors || snapshot.saveError) && (
        <div role="alert" className="mb-6 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {snapshot.saveError ??
            "Your saved data couldn't be read, so Stash Atlas started fresh. A copy of the unreadable data was kept in this browser's storage."}
        </div>
      )}

      {hasAccounts ? (
        <div className="space-y-6">
          <AccountTable
            data={data}
            onEdit={(account) => setModal({ kind: "account", account })}
            onDelete={(account) => setModal({ kind: "deleteAccount", account })}
          />
        </div>
      ) : (
        <EmptyState
          onAddAccount={() => setModal({ kind: "account", account: null })}
          onLoadSample={() => setPortfolio(samplePortfolio())}
        />
      )}

      <AccountDialog
        open={modal?.kind === "account"}
        account={modal?.kind === "account" ? modal.account : null}
        data={data}
        onClose={close}
      />
      <AssetClassDialog open={modal?.kind === "assetClasses"} data={data} onClose={close} />
      <ConfirmDialog
        open={modal?.kind === "deleteAccount"}
        title="Delete account?"
        description={
          modal?.kind === "deleteAccount"
            ? `"${modal.account.name}" will be removed from this browser. This can't be undone unless you have an export.`
            : ""
        }
        confirmLabel="Delete account"
        tone="danger"
        onConfirm={() => {
          if (modal?.kind === "deleteAccount") {
            const id = modal.account.id;
            updatePortfolio((d) => deleteAccount(d, id));
          }
        }}
        onClose={close}
      />
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
