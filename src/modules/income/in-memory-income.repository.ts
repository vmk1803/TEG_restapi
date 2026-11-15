import type { IncomeStore } from "./income.store";
import type { CreateIncomeInput, IncomeAllocation, IncomeRecord } from "./income.types";

export class InMemoryIncomeRepository implements IncomeStore {
  private readonly incomes = new Map<string, IncomeRecord>();

  async create(input: CreateIncomeInput): Promise<IncomeRecord> {
    const record: IncomeRecord = {
      id: input.id,
      userId: input.userId,
      totalIncome: input.totalIncome,
      allocations: input.allocations.map((allocation) => ({ ...allocation })),
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    };

    this.incomes.set(record.id, record);
    return {
      ...record,
      allocations: record.allocations.map((allocation) => ({ ...allocation }))
    };
  }

  async listByUserId(userId: string): Promise<IncomeRecord[]> {
    return Array.from(this.incomes.values())
      .filter((income) => income.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((income) => ({
        ...income,
        allocations: income.allocations.map((allocation) => ({ ...allocation }))
      }));
  }

  async findLatestByUserId(userId: string): Promise<IncomeRecord | null> {
    const [latestIncome] = await this.listByUserId(userId);
    return latestIncome ?? null;
  }

  async findById(id: string): Promise<IncomeRecord | null> {
    const income = this.incomes.get(id);

    if (!income) {
      return null;
    }

    return {
      ...income,
      allocations: income.allocations.map((allocation) => ({ ...allocation }))
    };
  }

  async update(
    incomeId: string,
    input: { totalIncome: number; allocations: IncomeAllocation[]; updatedAt: string }
  ): Promise<IncomeRecord | null> {
    const existingIncome = this.incomes.get(incomeId);

    if (!existingIncome) {
      return null;
    }

    const updatedIncome: IncomeRecord = {
      ...existingIncome,
      totalIncome: input.totalIncome,
      allocations: input.allocations.map((allocation) => ({ ...allocation })),
      updatedAt: input.updatedAt
    };

    this.incomes.set(incomeId, updatedIncome);
    return {
      ...updatedIncome,
      allocations: updatedIncome.allocations.map((allocation) => ({ ...allocation }))
    };
  }

  async delete(incomeId: string): Promise<boolean> {
    return this.incomes.delete(incomeId);
  }
}
