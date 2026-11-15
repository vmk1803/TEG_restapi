import type { IncomeCategoryCode } from "../income/income.types";

export type RecurringExpenseRecord = {
  id: string;
  userId: string;
  category: IncomeCategoryCode;
  description: string;
  amount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateRecurringExpenseInput = {
  id: string;
  userId: string;
  category: IncomeCategoryCode;
  description: string;
  amount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecurringExpenseView = RecurringExpenseRecord & {
  categoryName: string;
};
