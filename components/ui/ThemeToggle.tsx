"use client";

import { useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

export const THEME_KEY = "stash-atlas:theme";

type Theme = "system" | "light" | "dark";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABELS: Record<Theme, string> = {
  system: "Theme: match system",
  light: "Theme: light",
  dark: "Theme: dark",
};

const listeners = new Set<() => void>();

function readTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Theme still applies for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Cycles system → light → dark. The no-flash script in layout.tsx applies it on load. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = theme === "light" ? SunIcon : theme === "dark" ? MoonIcon : MonitorIcon;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex size-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
      aria-label={`${LABELS[theme]}. Switch to ${next}.`}
      title={LABELS[theme]}
    >
      <Icon width="18" height="18" />
    </button>
  );
}
