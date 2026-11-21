import { createId } from "../../lib/crypto";
import { HttpError } from "../../lib/http-error";
import { incomeCategories } from "../income/income.types";
import type { ExpenseStore } from "./expense.store";
import type { ExpenseInputSource, ExpenseRecord, ExpenseView } from "./expense.types";

const expenseCategoryMap = new Map(incomeCategories.map((category) => [category.code, category.name]));

export class ExpenseService {
  constructor(private readonly expenseStore: ExpenseStore) {}

  getCategories() {
    return incomeCategories;
  }

  async createExpense(input: {
    userId: string;
    category: ExpenseRecord["category"];
    description: string;
    amount: number;
    spentDate: string;
    inputText?: string;
    inputSource?: ExpenseInputSource;
  }): Promise<ExpenseView> {
    this.validateExpense(input.category, input.description, input.amount, input.spentDate);

    const now = new Date().toISOString();
    const expense = await this.expenseStore.create({
      id: createId(),
      userId: input.userId,
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      spentDate: input.spentDate,
      inputText: input.inputText?.trim() ?? null,
      inputSource: input.inputSource ?? null,
      createdAt: now,
      updatedAt: now
    });

    return this.toExpenseView(expense);
  }

  async listExpenses(userId: string): Promise<ExpenseView[]> {
    const expenses = await this.expenseStore.listByUserId(userId);
    return expenses.map((expense) => this.toExpenseView(expense));
  }

  async updateExpense(input: {
    userId: string;
    expenseId: string;
    category: ExpenseRecord["category"];
    description: string;
    amount: number;
    spentDate: string;
  }): Promise<ExpenseView> {
    this.validateExpense(input.category, input.description, input.amount, input.spentDate);

    const existingExpense = await this.getOwnedExpense(input.userId, input.expenseId);

    if (existingExpense.recurringId) {
      throw new HttpError(
        409,
        "This expense is generated from a recurring template. Edit the recurring item instead.",
        "LOCKED_RECURRING"
      );
    }
    const updatedExpense = await this.expenseStore.update(existingExpense.id, {
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      spentDate: input.spentDate,
      updatedAt: new Date().toISOString()
    });

    if (!updatedExpense) {
      throw new HttpError(404, "Expense entry not found.");
    }

    return this.toExpenseView(updatedExpense);
  }

  async deleteExpense(userId: string, expenseId: string): Promise<void> {
    const existingExpense = await this.getOwnedExpense(userId, expenseId);

    if (existingExpense.recurringId) {
      throw new HttpError(
        409,
        "This expense is generated from a recurring template. Delete the recurring item instead.",
        "LOCKED_RECURRING"
      );
    }

    const deleted = await this.expenseStore.delete(existingExpense.id);

    if (!deleted) {
      throw new HttpError(404, "Expense entry not found.");
    }
  }

  private async getOwnedExpense(userId: string, expenseId: string): Promise<ExpenseRecord> {
    const expense = await this.expenseStore.findById(expenseId);

    if (!expense || expense.userId !== userId) {
      throw new HttpError(404, "Expense entry not found.");
    }

    return expense;
  }

  private validateExpense(
    category: ExpenseRecord["category"],
    description: string,
    amount: number,
    spentDate: string
  ): void {
    if (!expenseCategoryMap.has(category)) {
      throw new HttpError(400, `Invalid category: ${category}`);
    }

    if (!description.trim()) {
      throw new HttpError(400, "Description is required.");
    }

    if (amount <= 0) {
      throw new HttpError(400, "Amount must be greater than zero.");
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentDate)) {
      throw new HttpError(400, "spentDate must be in YYYY-MM-DD format.");
    }
  }

  private toExpenseView(expense: ExpenseRecord): ExpenseView {
    return {
      ...expense,
      categoryName: expenseCategoryMap.get(expense.category) ?? expense.category
    };
  }
}
