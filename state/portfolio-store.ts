"use client";

import { useSyncExternalStore } from "react";
import { emptyPortfolio } from "@/lib/defaults";
import type { PortfolioData } from "@/lib/schema";
import { STORAGE_KEY, loadFromStorage, saveToStorage } from "@/lib/storage";

/**
 * The portfolio lives in localStorage. This module is the single in-memory
 * copy, exposed through useSyncExternalStore so every component re-renders
 * on change, and it stays in sync across tabs via the `storage` event.
 */

export type PortfolioSnapshot =
  | { status: "loading" }
  | {
      status: "ready";
      data: PortfolioData;
      /** Stored data existed but couldn't be read; it was backed up, not overwritten. */
      loadErrors: string[] | null;
      /** Saving failed (e.g. storage disabled); changes live only in this tab. */
      saveError: string | null;
    };

const LOADING: PortfolioSnapshot = { status: "loading" };
const CORRUPT_BACKUP_KEY = `${STORAGE_KEY}:unreadable-backup`;

let snapshot: PortfolioSnapshot | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSnapshot(): PortfolioSnapshot {
  const store = storage();
  if (!store) {
    return {
      status: "ready",
      data: emptyPortfolio(),
      loadErrors: null,
      saveError: "This browser is blocking local storage, so changes won't be saved.",
    };
  }
  let result;
  try {
    result = loadFromStorage(store);
  } catch {
    result = null;
  }
  if (result === null) {
    return { status: "ready", data: emptyPortfolio(), loadErrors: null, saveError: null };
  }
  if (result.ok) {
    return { status: "ready", data: result.data, loadErrors: null, saveError: null };
  }
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw !== null) store.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // Best effort only.
  }
  return { status: "ready", data: emptyPortfolio(), loadErrors: result.errors, saveError: null };
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      snapshot = readSnapshot();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): PortfolioSnapshot {
  if (snapshot === null) snapshot = readSnapshot();
  return snapshot;
}

function getServerSnapshot(): PortfolioSnapshot {
  return LOADING;
}

export function usePortfolio(): PortfolioSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Replace the whole portfolio and persist it. */
export function setPortfolio(data: PortfolioData) {
  let saveError: string | null = null;
  const store = storage();
  try {
    if (!store) throw new Error("no storage");
    saveToStorage(store, data);
  } catch {
    saveError = "Couldn't save to this browser's storage. Export your data to keep it.";
  }
  snapshot = { status: "ready", data, loadErrors: null, saveError };
  emit();
}

/** Apply a change to the current portfolio. */
export function updatePortfolio(change: (data: PortfolioData) => PortfolioData) {
  const current = getSnapshot();
  if (current.status !== "ready") return;
  setPortfolio(change(current.data));
}
