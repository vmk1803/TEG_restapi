import type { ExpenseStore } from "./expense.store";
import type { CreateExpenseInput, ExpenseRecord } from "./expense.types";

export class InMemoryExpenseRepository implements ExpenseStore {
  private readonly expenses = new Map<string, ExpenseRecord>();

  async create(input: CreateExpenseInput): Promise<ExpenseRecord> {
    const record: ExpenseRecord = {
      ...input,
      recurringId: input.recurringId ?? null,
      inputText: input.inputText ?? null,
      inputSource: input.inputSource ?? null
    };
    this.expenses.set(record.id, record);
    return { ...record };
  }

  async listByUserId(userId: string): Promise<ExpenseRecord[]> {
    return Array.from(this.expenses.values())
      .filter((expense) => expense.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((expense) => ({ ...expense }));
  }

  async findById(id: string): Promise<ExpenseRecord | null> {
    const expense = this.expenses.get(id);
    return expense ? { ...expense } : null;
  }

  async findByRecurringAndDate(recurringId: string, spentDate: string): Promise<ExpenseRecord | null> {
    const match = Array.from(this.expenses.values()).find(
      (expense) => expense.recurringId === recurringId && expense.spentDate === spentDate
    );
    return match ? { ...match } : null;
  }

  async update(
    expenseId: string,
    input: {
      category: CreateExpenseInput["category"];
      description: string;
      amount: number;
      spentDate: string;
      updatedAt: string;
    }
  ): Promise<ExpenseRecord | null> {
    const existingExpense = this.expenses.get(expenseId);

    if (!existingExpense) {
      return null;
    }

    const updatedExpense: ExpenseRecord = {
      ...existingExpense,
      category: input.category,
      description: input.description,
      amount: input.amount,
      spentDate: input.spentDate,
      updatedAt: input.updatedAt
    };

    this.expenses.set(expenseId, updatedExpense);
    return { ...updatedExpense };
  }

  async delete(expenseId: string): Promise<boolean> {
    return this.expenses.delete(expenseId);
  }
}
