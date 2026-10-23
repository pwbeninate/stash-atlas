import { z } from "zod";

/** Bump when the stored shape changes; add a step to `migrate()` in storage.ts. */
export const SCHEMA_VERSION = 2;

/** Allocations are stored in basis points: 10,000 bps = 100.00%. */
export const BPS_TOTAL = 10_000;

/** $100B per account keeps every sum far inside Number.MAX_SAFE_INTEGER. */
export const MAX_BALANCE_CENTS = 10_000_000_000_000;
export const MAX_ACCOUNTS = 500;
export const MAX_ASSET_CLASSES = 50;

/**
 * Tax treatments are the columns of the location views. Every dollar is in
 * exactly one of them.
 */
export const TAX_TREATMENTS = [
  "taxable",
  "traditional",
  "roth",
  "hsa",
  "529",
  "other",
] as const;
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

/**
 * Account types are what the user picks. Each is a single tax treatment,
 * except "mixed": one 401(k)/IRA holding both traditional and Roth money,
 * split by the account's `rothBps`.
 */
export const ACCOUNT_TYPES = [
  "taxable",
  "traditional",
  "roth",
  "mixed",
  "hsa",
  "529",
  "other",
] as const;

export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  taxable: "Taxable",
  traditional: "Traditional 401(k)/IRA",
  roth: "Roth 401(k)/IRA",
  mixed: "Traditional + Roth 401(k)/IRA",
  hsa: "HSA",
  "529": "529 / Education",
  other: "Other",
};

/** Short labels for chart axes and narrow table headers. */
export const TREATMENT_SHORT_LABELS: Record<TaxTreatment, string> = {
  taxable: "Taxable",
  traditional: "Traditional",
  roth: "Roth",
  hsa: "HSA",
  "529": "529",
  other: "Other",
};

/** How each treatment reads in a sentence ("…of your bonds is in Roth money"). */
export const TREATMENT_PHRASES: Record<TaxTreatment, string> = {
  taxable: "taxable accounts",
  traditional: "traditional (pre-tax) money",
  roth: "Roth money",
  hsa: "HSAs",
  "529": "529 plans",
  other: "other accounts",
};

export const TAX_BUCKETS = ["taxable", "pretax", "taxfree", "other"] as const;
export type TaxBucket = (typeof TAX_BUCKETS)[number];

export const TAX_BUCKET_LABELS: Record<TaxBucket, string> = {
  taxable: "Taxable",
  pretax: "Pre-tax",
  taxfree: "Tax-free",
  other: "Other",
};

export const TAX_BUCKET_DESCRIPTIONS: Record<TaxBucket, string> = {
  taxable: "Brokerage and other taxable accounts",
  pretax: "Traditional 401(k) and IRA money",
  taxfree: "Roth money, HSA, and 529",
  other: "Accounts marked Other",
};

export const TAX_BUCKET_BY_TREATMENT: Record<TaxTreatment, TaxBucket> = {
  taxable: "taxable",
  traditional: "pretax",
  roth: "taxfree",
  hsa: "taxfree",
  "529": "taxfree",
  other: "other",
};

const IdSchema = z.string().min(1).max(64);
const BpsSchema = z.int().min(0).max(BPS_TOTAL);

export const AssetClassSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1, "Name is required").max(40),
  colorIndex: z.int().min(0).max(63),
  builtIn: z.boolean(),
});
export type AssetClass = z.infer<typeof AssetClassSchema>;

/** Asset class id → basis points. Entries must add up to exactly 100%. */
export const AllocationSchema = z
  .record(IdSchema, BpsSchema)
  .refine(
    (allocation) =>
      Object.values(allocation).reduce((sum, bps) => sum + bps, 0) ===
      BPS_TOTAL,
    { message: "Allocation must add up to 100%" },
  );
export type Allocation = z.infer<typeof AllocationSchema>;

export const AccountSchema = z
  .object({
    id: IdSchema,
    name: z.string().trim().min(1, "Name is required").max(80),
    type: AccountTypeSchema,
    balanceCents: z
      .int("Balance must be in whole cents")
      .min(0, "Balance can't be negative")
      .max(MAX_BALANCE_CENTS, "Balance is too large"),
    allocation: AllocationSchema,
    /** "mixed" accounts only: the Roth share of the balance; the rest is traditional. */
    rothBps: BpsSchema.optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((account, ctx) => {
    if (account.type === "mixed" && account.rothBps === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["rothBps"],
        message: "A Traditional + Roth account needs its Roth share",
      });
    }
    if (account.type !== "mixed" && account.rothBps !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["rothBps"],
        message: "Only Traditional + Roth accounts have a Roth share",
      });
    }
  });
export type Account = z.infer<typeof AccountSchema>;

export const PortfolioSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    assetClasses: z.array(AssetClassSchema).min(1).max(MAX_ASSET_CLASSES),
    accounts: z.array(AccountSchema).max(MAX_ACCOUNTS),
  })
  .superRefine((data, ctx) => {
    const classIds = new Set<string>();
    data.assetClasses.forEach((assetClass, i) => {
      if (classIds.has(assetClass.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["assetClasses", i, "id"],
          message: `Duplicate asset class id "${assetClass.id}"`,
        });
      }
      classIds.add(assetClass.id);
    });

    const accountIds = new Set<string>();
    data.accounts.forEach((account, i) => {
      if (accountIds.has(account.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["accounts", i, "id"],
          message: `Duplicate account id "${account.id}"`,
        });
      }
      accountIds.add(account.id);
      for (const classId of Object.keys(account.allocation)) {
        if (!classIds.has(classId)) {
          ctx.addIssue({
            code: "custom",
            path: ["accounts", i, "allocation", classId],
            message: `Unknown asset class "${classId}"`,
          });
        }
      }
    });
  });
export type PortfolioData = z.infer<typeof PortfolioSchema>;
