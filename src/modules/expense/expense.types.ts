import type { IncomeCategoryCode } from "../income/income.types";

/** How an expense was entered via Smart Add; null for form/recurring entries. */
export type ExpenseInputSource = "voice" | "text";

export type ExpenseRecord = {
  id: string;
  userId: string;
  category: IncomeCategoryCode;
  description: string;
  amount: number;
  spentDate: string;
  recurringId: string | null;
  inputText: string | null;
  inputSource: ExpenseInputSource | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateExpenseInput = {
  id: string;
  userId: string;
  category: IncomeCategoryCode;
  description: string;
  amount: number;
  spentDate: string;
  recurringId?: string | null;
  inputText?: string | null;
  inputSource?: ExpenseInputSource | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseView = ExpenseRecord & {
  categoryName: string;
};
