import type { ExpenseStore } from "../expense/expense.store";
import type { ExpenseRecord } from "../expense/expense.types";
import type { IncomeStore } from "../income/income.store";
import {
  incomeCategories,
  type IncomeAllocationView,
  type IncomeCategoryCode,
  type IncomeRecord,
  type IncomeView
} from "../income/income.types";
import type { OverviewCategoryMetric, OverviewResponse } from "./overview.types";

const categoryMap = new Map(incomeCategories.map((category) => [category.code, category.name]));

export class OverviewService {
  constructor(
    private readonly incomeStore: IncomeStore,
    private readonly expenseStore: ExpenseStore
  ) {}

  async getOverview(userId: string): Promise<OverviewResponse> {
    const [activeIncomeRecord, expenses] = await Promise.all([
      this.incomeStore.findLatestByUserId(userId),
      this.expenseStore.listByUserId(userId)
    ]);

    const activeIncome = activeIncomeRecord ? this.toIncomeView(activeIncomeRecord) : null;
    const spentByCategory = this.sumSpentByCategory(expenses);
    const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const categories = incomeCategories.map((category): OverviewCategoryMetric => {
      const allocated =
        activeIncome?.allocations.find((allocation) => allocation.category === category.code)?.limit ?? 0;
      const spent = spentByCategory.get(category.code) ?? 0;

      return {
        category: category.code,
        categoryName: category.name,
        allocated,
        spent,
        remaining: allocated - spent
      };
    });

    const totalIncome = activeIncome?.totalIncome ?? 0;
    const totalAllocated = activeIncome?.totalAllocated ?? 0;
    const remainingIncome = activeIncome?.remainingIncome ?? 0;

    return {
      summary: {
        totalIncome,
        totalAllocated,
        remainingIncome,
        totalSpent,
        remainingAfterSpending: totalIncome - totalSpent
      },
      categories,
      activeIncome
    };
  }

  private sumSpentByCategory(expenses: ExpenseRecord[]): Map<IncomeCategoryCode, number> {
    const totals = new Map<IncomeCategoryCode, number>();

    for (const expense of expenses) {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
    }

    return totals;
  }

  private toIncomeView(income: IncomeRecord): IncomeView {
    const allocations: IncomeAllocationView[] = income.allocations.map((allocation) => ({
      ...allocation,
      categoryName: categoryMap.get(allocation.category) ?? allocation.category
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
