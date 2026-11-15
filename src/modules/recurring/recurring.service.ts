import { createId } from "../../lib/crypto";
import { HttpError } from "../../lib/http-error";
import type { IncomeStore } from "../income/income.store";
import {
  incomeCategories,
  type IncomeCategoryCode
} from "../income/income.types";
import type { RecurringExpenseStore } from "./recurring.store";
import type { RecurringExpenseRecord, RecurringExpenseView } from "./recurring.types";

const categoryNameMap = new Map(incomeCategories.map((category) => [category.code, category.name]));

export class RecurringExpenseService {
  constructor(
    private readonly recurringStore: RecurringExpenseStore,
    private readonly incomeStore: IncomeStore
  ) {}

  async createRecurring(input: {
    userId: string;
    category: IncomeCategoryCode;
    description: string;
    amount: number;
  }): Promise<RecurringExpenseView> {
    if (!categoryNameMap.has(input.category)) {
      throw new HttpError(400, `Invalid category: ${input.category}`);
    }

    const description = input.description.trim();
    if (!description) {
      throw new HttpError(400, "Description is required.");
    }

    if (input.amount <= 0) {
      throw new HttpError(400, "Amount must be greater than zero.");
    }

    await this.assertWithinBudget(input.userId, input.category, input.amount);

    const now = new Date().toISOString();
    const record = await this.recurringStore.create({
      id: createId(),
      userId: input.userId,
      category: input.category,
      description,
      amount: input.amount,
      active: true,
      createdAt: now,
      updatedAt: now
    });

    return this.toView(record);
  }

  async listRecurring(userId: string): Promise<RecurringExpenseView[]> {
    const records = await this.recurringStore.listByUserId(userId);
    return records.map((record) => this.toView(record));
  }

  async deleteRecurring(userId: string, recurringId: string): Promise<void> {
    const existing = await this.recurringStore.findById(recurringId);
    if (!existing || existing.userId !== userId) {
      throw new HttpError(404, "Recurring entry not found.");
    }

    const deleted = await this.recurringStore.delete(existing.id);
    if (!deleted) {
      throw new HttpError(404, "Recurring entry not found.");
    }
  }

  private async assertWithinBudget(
    userId: string,
    category: IncomeCategoryCode,
    newAmount: number
  ): Promise<void> {
    const income = await this.incomeStore.findLatestByUserId(userId);
    if (!income) {
      throw new HttpError(
        400,
        "Set up your monthly income and budget before adding recurring items.",
        "NO_BUDGET"
      );
    }

    const allocation = income.allocations.find((item) => item.category === category);
    if (!allocation) {
      throw new HttpError(
        400,
        "Add a budget for this category before adding recurring items.",
        "CATEGORY_NOT_BUDGETED"
      );
    }

    const existing = await this.recurringStore.listByUserId(userId);
    const existingTotal = existing
      .filter((record) => record.category === category && record.active)
      .reduce((sum, record) => sum + record.amount, 0);

    if (existingTotal + newAmount > allocation.limit) {
      throw new HttpError(
        400,
        `Recurring total for ${allocation.category} would be ${existingTotal + newAmount}, exceeding the budget of ${allocation.limit}.`,
        "BUDGET_EXCEEDED"
      );
    }
  }

  private toView(record: RecurringExpenseRecord): RecurringExpenseView {
    return {
      ...record,
      categoryName: categoryNameMap.get(record.category) ?? record.category
    };
  }
}
