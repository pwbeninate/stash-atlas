# Stash Atlas

A private, local-first dashboard for seeing your investment portfolio two ways:

- **Asset allocation** shows what you own across every account (US stocks, bonds, cash, …).
- **Asset location** shows which kinds of accounts hold it: taxable, pre-tax, or tax-free.

You enter each account's balance and how it's invested. Everything stays in your browser's
local storage. There's no backend, no sign-up, and no account linking, and the app never
asks for account numbers.

> Stash Atlas is informational only. It doesn't give tax or investment advice.

## Getting started

Requires Node.js 20.9+ (developed on Node 26).

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build (the page prerenders as static HTML) |
| `npm start` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

**Deploying:** import the repo into Vercel and accept the defaults. It needs no environment
variables or configuration.

Use **Data → Load sample data** to explore with a fictional portfolio.

## Features

- **Accounts:** add, edit, and delete. Each account has a name, an account type, a balance,
  and an allocation entered as **percentages** (with a live "remaining" indicator) or
  **dollar amounts** (the balance becomes their sum). An allocation that doesn't total
  exactly 100% can't be saved.
- **Asset classes:** seven defaults that you can rename, plus custom classes. A class can
  only be removed once no account holds it.
- **Dashboard:**
  - Summary cards: total value, plus the share in each tax bucket. Taxable; Pre-tax;
    Tax-free, which covers Roth, HSA, and 529; and Other.
  - A donut chart of asset classes with an exact-value legend.
  - A stacked bar of each account type's mix, shown in $ or %.
  - **The location matrix:** asset class × account type, with dollars and percentages. A
    toggle switches between "% of asset class" (where each asset lives) and "% of account
    type" (what each account type holds).
  - A sortable account list with a mini allocation bar per account.
- **Data:** JSON export and import, sample data, and clear-all. Every replace or clear asks
  for confirmation first.
- Light and dark mode, which follows your system unless you pin one. Layouts run from
  375px phones up to desktop.

## Architecture

```
app/                 Next.js App Router shell (layout, page, global CSS tokens)
components/
  Dashboard.tsx      Page composition, modals, import/export wiring
  accounts/          Account dialog + allocation input
  dashboard/         Summary cards, donut, stacked bar, location matrix, account table
  settings/          Asset class manager, Data menu
  ui/                Small primitives (Button, Dialog, Segmented, ThemeToggle, …)
lib/                 Pure TypeScript, no React, each module with a colocated *.test.ts
  schema.ts          Zod schemas → TypeScript types; account types and tax buckets
  money.ts           Cents/bps parsing and formatting, largest-remainder rounding
  aggregate.ts       byAssetClass, byAccountType, taxBuckets, locationMatrix
  draft.ts           Account form validation (percent and dollar modes)
  ops.ts             Immutable portfolio edits (accounts, asset classes)
  storage.ts         Parse, migrate, serialize; localStorage helpers
  defaults.ts        Default asset classes and sample portfolio
  palette.ts, scale.ts
state/
  portfolio-store.ts localStorage-backed store via useSyncExternalStore (syncs across tabs)
```

**Why Recharts and not visx:** the donut and stacked bar are standard charts, so Recharts
covers them. The location matrix is a semantic HTML `<table>` heatmap, not a chart: it
stays accessible to screen readers, you can copy from it, and it scrolls horizontally on
small screens with a sticky first column. visx wouldn't add anything here.

**Colors:** the chart palette is an 8-hue categorical set, validated for colorblind
separation in fixed order, with separate light and dark steps. "Other" and any custom
classes past the eighth hue use neutral grays. Every chart also has a legend or table, so
color is never the only cue. All colors are CSS custom properties in `app/globals.css`.

## Data model

Data is validated with Zod (`lib/schema.ts`), and TypeScript types are inferred from the
schemas.

```ts
PortfolioData {
  schemaVersion: 1
  assetClasses: AssetClass[]      // ordered; order drives charts and tables
  accounts: Account[]
}

AssetClass {
  id: string                      // "us-stocks", or a UUID for custom classes
  name: string                    // 1–40 chars, unique (case-insensitive)
  colorIndex: number              // palette slot: 0–7 hues, 8+ neutrals
  builtIn: boolean
}

Account {
  id: string                      // UUID
  name: string                    // 1–80 chars; no account numbers
  type: "taxable" | "traditional" | "roth" | "hsa" | "529" | "other"
  balanceCents: number            // integer cents, 0 … $100B
  allocation: Record<assetClassId, number>  // integer basis points; must sum to 10,000
  createdAt: string; updatedAt: string      // ISO timestamps
}
```

### Money math

- Balances are integer **cents** and allocations are integer **basis points**
  (1 bp = 0.01%). User input is parsed from strings straight to integers, so floats never
  touch it.
- To get per-class dollars, each account's balance is split with the **largest-remainder
  method** (`largestRemainder` in `lib/money.ts`, using BigInt). The pieces always add up
  to the balance exactly. Every aggregate is a sum of those integers, so the matrix rows,
  columns, and grand total reconcile to the cent.
- Displayed percentages use the same method (`roundedPercents`), so a row or column shown
  at one decimal adds up to exactly 100.0%.
- In dollar-entry mode, amounts are converted to basis points the same way. A typed amount
  can therefore shift by up to 0.005% of the balance; storing percentages keeps the
  allocation intact when a balance changes or is $0.

### Storage and versioning

- Data lives in `localStorage` under `stash-atlas:data`. The theme preference is stored
  separately under `stash-atlas:theme`.
- Stored data and imported files go through the same path: `migrate()` and then Zod
  validation (`parsePortfolio` in `lib/storage.ts`).
- To change the schema:
  1. Bump `SCHEMA_VERSION`.
  2. Add a `case` in `migrate()` that upgrades the previous version.
  3. Update the schema.
- Files from a newer version are rejected with a clear message.
- If stored data is unreadable, the app starts fresh and keeps the original under
  `stash-atlas:data:unreadable-backup` instead of overwriting it.
- Exports add `app` and `exportedAt` fields. Import ignores them, so export → import
  restores identical data (there's a unit test for this).

## Testing

`npm test` runs the Vitest suites in `lib/`. They cover:

- **Aggregation edge cases:** an empty portfolio, $0 accounts, an all-$0 portfolio (no NaN),
  a single account, 100% in one asset class, unused classes, and odd-cent thirds where every
  matrix row, column, and total must reconcile exactly.
- **Parsing:** dollar and percent input, plus formatting.
- **Form validation:** under or over 100%, bad input, dollar mode, and switching between
  modes.
- **Schema and import validation:** unknown classes, duplicate ids, and future versions.
- **Storage:** export/import round trips and the storage helpers.

## Ideas for v2

The current design leaves room for each of these:

- **Target allocation and drift.** Add `targets: Record<assetClassId, bps>` to the
  portfolio (a migration to schemaVersion 2). Drift is `byAssetClass` share minus target,
  shown as a diverging bar.
- **Per-holding entry.** Add optional `holdings: { ticker, amountCents, assetClassId }[]` to
  an account and derive `allocation` from it. A ticker → asset class map could start as a
  small static table.
- **Asset location hints.** These would be informational only, for example noting where bonds
  sit relative to tax-advantaged space. They'd be built on `locationMatrix`, which already
  exposes the row and column shares.
- **Historical snapshots.** Add `snapshots: { date, accounts }[]` and a net-worth trend line.
  The aggregate functions take plain data, so they work on any snapshot.
- **Storage.** Move to IndexedDB if snapshots make the data large, and optionally add
  encrypted sync.
