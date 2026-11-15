import type { IncomeCategoryCode } from "../income/income.types";

export const BUDGET_RULES = ["50/30/20", "60/20/20", "70/20/10"] as const;
export type BudgetRule = (typeof BUDGET_RULES)[number];

export type RuleBucketPercents = {
  needs: number;
  wants: number;
  saveInvest: number;
};

export const ruleBucketPercents: Record<BudgetRule, RuleBucketPercents> = {
  "50/30/20": { needs: 50, wants: 30, saveInvest: 20 },
  "60/20/20": { needs: 60, wants: 20, saveInvest: 20 },
  "70/20/10": { needs: 70, wants: 20, saveInvest: 10 }
};

export type BucketKey = "needs" | "wants" | "saveInvest";

export type BucketCategoryDefault = {
  code: IncomeCategoryCode;
  name: string;
  weight: number;
};

export type BucketDefinition = {
  name: string;
  categories: BucketCategoryDefault[];
};

export const bucketCategories: Record<BucketKey, BucketDefinition> = {
  needs: {
    name: "Needs",
    categories: [
      { code: "HOUSING", name: "Housing / Rent", weight: 30 },
      { code: "EMI_LOAN", name: "Loan EMIs", weight: 20 },
      { code: "GROCERIES", name: "Groceries", weight: 15 },
      { code: "UTILITIES", name: "Utilities", weight: 8 },
      { code: "TRANSPORT", name: "Transport", weight: 8 },
      { code: "HEALTHCARE", name: "Healthcare", weight: 7 },
      { code: "INSURANCE", name: "Insurance Premiums", weight: 7 },
      { code: "EDUCATION_KIDS", name: "Children's Education", weight: 5 }
    ]
  },
  wants: {
    name: "Wants",
    categories: [
      { code: "DINING_OUT", name: "Dining Out", weight: 20 },
      { code: "ENTERTAINMENT", name: "Entertainment", weight: 15 },
      { code: "SHOPPING", name: "Shopping", weight: 15 },
      { code: "TRAVEL", name: "Travel", weight: 15 },
      { code: "SUBSCRIPTIONS", name: "Subscriptions", weight: 10 },
      { code: "HOBBIES", name: "Hobbies", weight: 10 },
      { code: "PERSONAL_CARE", name: "Personal Care", weight: 8 },
      { code: "SELF_DEVELOPMENT", name: "Self-development", weight: 7 }
    ]
  },
  saveInvest: {
    name: "Save / Invest",
    categories: [
      { code: "INVESTMENTS", name: "Investments (SIP / MF)", weight: 30 },
      { code: "EMERGENCY_FUND", name: "Emergency Fund", weight: 25 },
      { code: "RETIREMENT", name: "Retirement", weight: 20 },
      { code: "DEBT_PREPAYMENT", name: "Debt Prepayment", weight: 10 },
      { code: "GOAL_SAVINGS", name: "Goal-based Savings", weight: 10 },
      { code: "SAVINGS", name: "General Savings", weight: 5 }
    ]
  }
};

// Fail fast at module load if any bucket's weights drift away from 100.
for (const [bucketKey, bucket] of Object.entries(bucketCategories)) {
  const total = bucket.categories.reduce((sum, category) => sum + category.weight, 0);
  if (total !== 100) {
    throw new Error(
      `Personalization catalog invariant broken: bucket "${bucketKey}" weights sum to ${total}, expected 100.`
    );
  }
}

export type RuleCatalogResponse = {
  rules: Array<{ code: BudgetRule; buckets: RuleBucketPercents }>;
  buckets: Record<BucketKey, BucketDefinition>;
};

export function getRuleCatalog(): RuleCatalogResponse {
  return {
    rules: BUDGET_RULES.map((code) => ({ code, buckets: ruleBucketPercents[code] })),
    buckets: bucketCategories
  };
}
