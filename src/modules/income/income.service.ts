import { createId } from "../../lib/crypto";
import { HttpError } from "../../lib/http-error";
import type { IncomeStore } from "./income.store";
import {
  incomeCategories,
  type IncomeAllocation,
  type IncomeCategoryCode,
  type IncomeRecord,
  type IncomeView
} from "./income.types";

const incomeCategoryMap = new Map(incomeCategories.map((category) => [category.code, category.name]));

export class IncomeService {
  constructor(private readonly incomeStore: IncomeStore) {}

  getCategories() {
    return incomeCategories;
  }

  async createIncome(input: {
    userId: string;
    totalIncome: number;
    allocations: IncomeAllocation[];
  }): Promise<IncomeView> {
    this.validatePayload(input.totalIncome, input.allocations);

    const now = new Date().toISOString();
    const income = await this.incomeStore.create({
      id: createId(),
      userId: input.userId,
      totalIncome: input.totalIncome,
      allocations: input.allocations,
      createdAt: now,
      updatedAt: now
    });

    return this.toIncomeView(income);
  }

  async listIncome(userId: string): Promise<IncomeView[]> {
    const incomes = await this.incomeStore.listByUserId(userId);
    return incomes.map((income) => this.toIncomeView(income));
  }

  async updateIncome(input: {
    userId: string;
    incomeId: string;
    totalIncome: number;
    allocations: IncomeAllocation[];
  }): Promise<IncomeView> {
    this.validatePayload(input.totalIncome, input.allocations);

    const existingIncome = await this.getOwnedIncome(input.userId, input.incomeId);
    const updatedIncome = await this.incomeStore.update(existingIncome.id, {
      totalIncome: input.totalIncome,
      allocations: input.allocations,
      updatedAt: new Date().toISOString()
    });

    if (!updatedIncome) {
      throw new HttpError(404, "Income entry not found.");
    }

    return this.toIncomeView(updatedIncome);
  }

  async deleteIncome(userId: string, incomeId: string): Promise<void> {
    const existingIncome = await this.getOwnedIncome(userId, incomeId);
    const deleted = await this.incomeStore.delete(existingIncome.id);

    if (!deleted) {
      throw new HttpError(404, "Income entry not found.");
    }
  }

  private async getOwnedIncome(userId: string, incomeId: string): Promise<IncomeRecord> {
    const income = await this.incomeStore.findById(incomeId);

    if (!income || income.userId !== userId) {
      throw new HttpError(404, "Income entry not found.");
    }

    return income;
  }

  private validatePayload(totalIncome: number, allocations: IncomeAllocation[]): void {
    if (allocations.length > 10) {
      throw new HttpError(400, "A maximum of 10 allocations is allowed per income entry.");
    }

    const seenCategories = new Set<IncomeCategoryCode>();
    let totalAllocated = 0;

    for (const allocation of allocations) {
      if (!incomeCategoryMap.has(allocation.category)) {
        throw new HttpError(400, `Invalid category: ${allocation.category}`);
      }

      if (seenCategories.has(allocation.category)) {
        throw new HttpError(400, `Duplicate category allocation: ${allocation.category}`);
      }

      if (allocation.limit <= 0) {
        throw new HttpError(400, "Allocation limits must be greater than zero.");
      }

      seenCategories.add(allocation.category);
      totalAllocated += allocation.limit;
    }

    if (totalAllocated > totalIncome) {
      throw new HttpError(400, "The sum of allocation limits cannot exceed total income.");
    }
  }

  private toIncomeView(income: IncomeRecord): IncomeView {
    const allocations = income.allocations.map((allocation) => ({
      ...allocation,
      categoryName: incomeCategoryMap.get(allocation.category) ?? allocation.category
    }));
    const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.limit, 0);

    return {
      id: income.id,
      userId: income.userId,
      totalIncome: income.totalIncome,
      allocations,
      totalAllocated,
      remainingIncome: income.totalIncome - totalAllocated,
      createdAt: income.createdAt,
      updatedAt: income.updatedAt
    };
  }
}
