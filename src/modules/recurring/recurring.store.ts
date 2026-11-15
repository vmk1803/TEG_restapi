import type { CreateRecurringExpenseInput, RecurringExpenseRecord } from "./recurring.types";

export interface RecurringExpenseStore {
  create(input: CreateRecurringExpenseInput): Promise<RecurringExpenseRecord>;
  listByUserId(userId: string): Promise<RecurringExpenseRecord[]>;
  listAllActive(): Promise<RecurringExpenseRecord[]>;
  findById(id: string): Promise<RecurringExpenseRecord | null>;
  delete(id: string): Promise<boolean>;
}
