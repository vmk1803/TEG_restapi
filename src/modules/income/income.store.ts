import type { CreateIncomeInput, IncomeRecord } from "./income.types";

export interface IncomeStore {
  create(input: CreateIncomeInput): Promise<IncomeRecord>;
  findLatestByUserId(userId: string): Promise<IncomeRecord | null>;
  listByUserId(userId: string): Promise<IncomeRecord[]>;
  findById(id: string): Promise<IncomeRecord | null>;
  update(
    incomeId: string,
    input: { totalIncome: number; allocations: CreateIncomeInput["allocations"]; updatedAt: string }
  ): Promise<IncomeRecord | null>;
  delete(incomeId: string): Promise<boolean>;
}
