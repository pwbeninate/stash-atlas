import { newId, nextColorIndex } from "./defaults";
import type { AccountFields } from "./draft";
import { MAX_ASSET_CLASSES, type Account, type PortfolioData } from "./schema";

/** Immutable portfolio edits. Each returns a new PortfolioData. */

export function addAccount(
  data: PortfolioData,
  fields: AccountFields,
  now: Date = new Date(),
  id: string = newId(),
): PortfolioData {
  const timestamp = now.toISOString();
  const account: Account = { id, ...fields, createdAt: timestamp, updatedAt: timestamp };
  return { ...data, accounts: [...data.accounts, account] };
}

export function updateAccount(
  data: PortfolioData,
  id: string,
  fields: AccountFields,
  now: Date = new Date(),
): PortfolioData {
  return {
    ...data,
    accounts: data.accounts.map((a) =>
      a.id === id ? { ...a, ...fields, updatedAt: now.toISOString() } : a,
    ),
  };
}

export function deleteAccount(data: PortfolioData, id: string): PortfolioData {
  return { ...data, accounts: data.accounts.filter((a) => a.id !== id) };
}

export function accountsUsingClass(data: PortfolioData, classId: string): Account[] {
  return data.accounts.filter((a) => (a.allocation[classId] ?? 0) > 0);
}

export type OpResult = { ok: true; data: PortfolioData } | { ok: false; error: string };

function nameTaken(data: PortfolioData, name: string, exceptId?: string): boolean {
  const key = name.trim().toLowerCase();
  return data.assetClasses.some(
    (c) => c.id !== exceptId && c.name.trim().toLowerCase() === key,
  );
}

function checkName(data: PortfolioData, name: string, exceptId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a name.";
  if (trimmed.length > 40) return "Keep it under 40 characters.";
  if (nameTaken(data, trimmed, exceptId)) return `"${trimmed}" already exists.`;
  return null;
}

export function addAssetClass(
  data: PortfolioData,
  name: string,
  id: string = newId(),
): OpResult {
  const error = checkName(data, name);
  if (error) return { ok: false, error };
  if (data.assetClasses.length >= MAX_ASSET_CLASSES) {
    return { ok: false, error: `You can have up to ${MAX_ASSET_CLASSES} asset classes.` };
  }
  return {
    ok: true,
    data: {
      ...data,
      assetClasses: [
        ...data.assetClasses,
        { id, name: name.trim(), colorIndex: nextColorIndex(data.assetClasses), builtIn: false },
      ],
    },
  };
}

export function renameAssetClass(data: PortfolioData, id: string, name: string): OpResult {
  const error = checkName(data, name, id);
  if (error) return { ok: false, error };
  return {
    ok: true,
    data: {
      ...data,
      assetClasses: data.assetClasses.map((c) =>
        c.id === id ? { ...c, name: name.trim() } : c,
      ),
    },
  };
}

export function deleteAssetClass(data: PortfolioData, id: string): OpResult {
  const users = accountsUsingClass(data, id);
  if (users.length > 0) {
    const names = users.map((a) => a.name).join(", ");
    return { ok: false, error: `Still used by ${names}. Reallocate those accounts first.` };
  }
  if (data.assetClasses.length <= 1) {
    return { ok: false, error: "Keep at least one asset class." };
  }
  return {
    ok: true,
    data: {
      ...data,
      assetClasses: data.assetClasses.filter((c) => c.id !== id),
      // Drop any zero-weight leftovers so stored allocations stay valid.
      accounts: data.accounts.map((a) => {
        if (!(id in a.allocation)) return a;
        const allocation = { ...a.allocation };
        delete allocation[id];
        return { ...a, allocation };
      }),
    },
  };
}
