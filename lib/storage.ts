import { PortfolioSchema, SCHEMA_VERSION, type PortfolioData } from "./schema";

export const STORAGE_KEY = "stash-atlas:data";

export type ParseResult =
  | { ok: true; data: PortfolioData }
  | { ok: false; errors: string[] };

/**
 * Bring older stored shapes up to the current schema. Each future version adds
 * a `case` that transforms vN → vN+1 and falls through to the next.
 */
export function migrate(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Expected a JSON object.");
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== "number") {
    throw new Error("Missing schemaVersion. Is this a Stash Atlas export?");
  }
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `This data uses schema version ${version}, but this app only understands up to ${SCHEMA_VERSION}.`,
    );
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Unsupported schema version ${version}.`);
  }
  let data = raw as Record<string, unknown>;
  // Each step upgrades vN → vN+1; add new steps below as the schema grows.
  if (data.schemaVersion === 1) {
    // v2 added the "mixed" account type and its optional rothBps. v1 data
    // is already valid v2 data.
    data = { ...data, schemaVersion: 2 };
  }
  return data;
}

/** Validate unknown input (stored or imported) into PortfolioData. */
export function parsePortfolio(raw: unknown): ParseResult {
  let migrated: unknown;
  try {
    migrated = migrate(raw);
  } catch (error) {
    return { ok: false, errors: [(error as Error).message] };
  }
  const result = PortfolioSchema.safeParse(migrated);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.slice(0, 20).map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}

export function parsePortfolioJson(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The file isn't valid JSON."] };
  }
  return parsePortfolio(raw);
}

/**
 * The export file. Extra metadata keys are ignored (stripped) on import, so
 * export → import yields data identical to what was exported.
 */
export function serializePortfolio(
  data: PortfolioData,
  exportedAt: Date = new Date(),
): string {
  return JSON.stringify(
    { app: "stash-atlas", exportedAt: exportedAt.toISOString(), ...data },
    null,
    2,
  );
}

export function exportFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `stash-atlas-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;

/** null when nothing is stored; an error result when stored data is unreadable. */
export function loadFromStorage(storage: ReadableStorage): ParseResult | null {
  const text = storage.getItem(STORAGE_KEY);
  if (text === null) return null;
  return parsePortfolioJson(text);
}

export function saveToStorage(storage: WritableStorage, data: PortfolioData) {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearStorage(storage: WritableStorage) {
  storage.removeItem(STORAGE_KEY);
}
