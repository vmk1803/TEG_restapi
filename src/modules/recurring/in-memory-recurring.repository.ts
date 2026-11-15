import type { RecurringExpenseStore } from "./recurring.store";
import type { CreateRecurringExpenseInput, RecurringExpenseRecord } from "./recurring.types";

export class InMemoryRecurringExpenseRepository implements RecurringExpenseStore {
  private readonly records = new Map<string, RecurringExpenseRecord>();

  async create(input: CreateRecurringExpenseInput): Promise<RecurringExpenseRecord> {
    const record: RecurringExpenseRecord = { ...input };
    this.records.set(record.id, record);
    return { ...record };
  }

  async listByUserId(userId: string): Promise<RecurringExpenseRecord[]> {
    return Array.from(this.records.values())
      .filter((record) => record.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => ({ ...record }));
  }

  async listAllActive(): Promise<RecurringExpenseRecord[]> {
    return Array.from(this.records.values())
      .filter((record) => record.active)
      .map((record) => ({ ...record }));
  }

  async findById(id: string): Promise<RecurringExpenseRecord | null> {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}
