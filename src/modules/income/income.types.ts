export const incomeCategories = [
  { code: "HOUSING", name: "Housing" },
  { code: "FOOD", name: "Food" },
  { code: "TRANSPORT", name: "Transport" },
  { code: "UTILITIES", name: "Utilities" },
  { code: "HEALTHCARE", name: "Healthcare" },
  { code: "EDUCATION", name: "Education" },
  { code: "SAVINGS", name: "Savings" },
  { code: "INVESTMENTS", name: "Investments" },
  { code: "ENTERTAINMENT", name: "Entertainment" },
  { code: "Loans", name: "Loans" },
  { code: "OTHER", name: "Other" },
  { code: "GROCERIES", name: "Groceries" },
  { code: "EMI_LOAN", name: "Loan EMIs" },
  { code: "INSURANCE", name: "Insurance Premiums" },
  { code: "EDUCATION_KIDS", name: "Children's Education" },
  { code: "CHILDCARE", name: "Childcare" },
  { code: "DINING_OUT", name: "Dining Out" },
  { code: "SUBSCRIPTIONS", name: "Subscriptions" },
  { code: "SHOPPING", name: "Shopping" },
  { code: "TRAVEL", name: "Travel" },
  { code: "HOBBIES", name: "Hobbies" },
  { code: "PERSONAL_CARE", name: "Personal Care" },
  { code: "SELF_DEVELOPMENT", name: "Self-development" },
  { code: "EMERGENCY_FUND", name: "Emergency Fund" },
  { code: "RETIREMENT", name: "Retirement" },
  { code: "DEBT_PREPAYMENT", name: "Debt Prepayment" },
  { code: "GOAL_SAVINGS", name: "Goal-based Savings" }
] as const;

export type IncomeCategory = (typeof incomeCategories)[number];
export type IncomeCategoryCode = IncomeCategory["code"];

export type IncomeAllocation = {
  category: IncomeCategoryCode;
  limit: number;
};

export type IncomeAllocationView = IncomeAllocation & {
  categoryName: string;
};

export type IncomeRecord = {
  id: string;
  userId: string;
  totalIncome: number;
  allocations: IncomeAllocation[];
  createdAt: string;
  updatedAt: string;
};

export type CreateIncomeInput = {
  id: string;
  userId: string;
  totalIncome: number;
  allocations: IncomeAllocation[];
  createdAt: string;
  updatedAt: string;
};

export type IncomeView = {
  id: string;
  userId: string;
  totalIncome: number;
  allocations: IncomeAllocationView[];
  totalAllocated: number;
  remainingIncome: number;
  createdAt: string;
  updatedAt: string;
};
