import {
  SCHEMA_VERSION,
  type Account,
  type AccountType,
  type AssetClass,
  type PortfolioData,
} from "./schema";

export const DEFAULT_ASSET_CLASSES: AssetClass[] = [
  { id: "us-stocks", name: "US Stocks", colorIndex: 0, builtIn: true },
  { id: "intl-stocks", name: "International Stocks", colorIndex: 1, builtIn: true },
  { id: "bonds", name: "Bonds", colorIndex: 2, builtIn: true },
  { id: "cash", name: "Cash", colorIndex: 3, builtIn: true },
  { id: "real-estate", name: "Real Estate", colorIndex: 4, builtIn: true },
  { id: "crypto", name: "Crypto", colorIndex: 5, builtIn: true },
  { id: "other", name: "Other", colorIndex: 6, builtIn: true },
];

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyPortfolio(): PortfolioData {
  return {
    schemaVersion: SCHEMA_VERSION,
    assetClasses: DEFAULT_ASSET_CLASSES.map((c) => ({ ...c })),
    accounts: [],
  };
}

/** Lowest color slot not already taken, so new classes get distinct colors. */
export function nextColorIndex(assetClasses: AssetClass[]): number {
  const used = new Set(assetClasses.map((c) => c.colorIndex));
  let i = 0;
  while (used.has(i)) i++;
  return Math.min(i, 63);
}

const SAMPLE_ACCOUNTS: {
  name: string;
  type: AccountType;
  balanceCents: number;
  allocation: Record<string, number>;
}[] = [
  {
    name: "Brokerage",
    type: "taxable",
    balanceCents: 84_250_00,
    allocation: { "us-stocks": 7000, "intl-stocks": 2500, cash: 500 },
  },
  {
    name: "High-yield savings",
    type: "taxable",
    balanceCents: 25_000_00,
    allocation: { cash: 10000 },
  },
  {
    name: "Workplace 401(k)",
    type: "traditional",
    balanceCents: 212_400_00,
    allocation: { "us-stocks": 5500, "intl-stocks": 2000, bonds: 2500 },
  },
  {
    name: "Roth IRA",
    type: "roth",
    balanceCents: 61_880_00,
    allocation: { "us-stocks": 6000, "intl-stocks": 3000, "real-estate": 1000 },
  },
  {
    name: "HSA",
    type: "hsa",
    balanceCents: 18_300_00,
    allocation: { "us-stocks": 8000, cash: 2000 },
  },
  {
    name: "529 College Savings",
    type: "529",
    balanceCents: 27_500_00,
    allocation: { "us-stocks": 6000, "intl-stocks": 2000, bonds: 2000 },
  },
  {
    name: "Crypto wallet",
    type: "other",
    balanceCents: 4_200_00,
    allocation: { crypto: 10000 },
  },
];

/** Fictional sample portfolio for exploring the app. */
export function samplePortfolio(now: Date = new Date()): PortfolioData {
  const timestamp = now.toISOString();
  const accounts: Account[] = SAMPLE_ACCOUNTS.map((a) => ({
    ...a,
    id: newId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  return { ...emptyPortfolio(), accounts };
}
