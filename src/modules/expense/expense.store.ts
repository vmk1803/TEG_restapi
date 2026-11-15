import type { CreateExpenseInput, ExpenseRecord } from "./expense.types";

export interface ExpenseStore {
  create(input: CreateExpenseInput): Promise<ExpenseRecord>;
  listByUserId(userId: string): Promise<ExpenseRecord[]>;
  findById(id: string): Promise<ExpenseRecord | null>;
  findByRecurringAndDate(recurringId: string, spentDate: string): Promise<ExpenseRecord | null>;
  update(
    expenseId: string,
    input: {
      category: CreateExpenseInput["category"];
      description: string;
      amount: number;
      spentDate: string;
      updatedAt: string;
    }
  ): Promise<ExpenseRecord | null>;
  delete(expenseId: string): Promise<boolean>;
}
