import { createId } from "../lib/crypto";
import type { ExpenseStore } from "../modules/expense/expense.store";
import type { RecurringExpenseStore } from "../modules/recurring/recurring.store";

function firstOfMonth(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-01`;
}

export async function generateRecurringExpensesForMonth(
  recurringStore: RecurringExpenseStore,
  expenseStore: ExpenseStore,
  year: number,
  month: number
): Promise<{ created: number; skipped: number }> {
  const spentDate = firstOfMonth(year, month);
  const active = await recurringStore.listAllActive();

  let created = 0;
  let skipped = 0;

  for (const template of active) {
    const existing = await expenseStore.findByRecurringAndDate(template.id, spentDate);
    if (existing) {
      skipped += 1;
      continue;
    }

    const now = new Date().toISOString();
    await expenseStore.create({
      id: createId(),
      userId: template.userId,
      category: template.category,
      description: template.description,
      amount: template.amount,
      spentDate,
      recurringId: template.id,
      createdAt: now,
      updatedAt: now
    });
    created += 1;
    console.log(
      `[recurring-job] created expense for recurring=${template.id} user=${template.userId} month=${spentDate}`
    );
  }

  return { created, skipped };
}

export function currentYearMonth(now: Date = new Date()): { year: number; month: number } {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
