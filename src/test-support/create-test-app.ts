import { createApp, type AppConfig } from "../app";
import { InMemoryRefreshTokenRepository } from "../modules/auth/in-memory-refresh-token.repository";
import { InMemoryExpenseRepository } from "../modules/expense/in-memory-expense.repository";
import { InMemoryIncomeRepository } from "../modules/income/in-memory-income.repository";
import { InMemoryRecurringExpenseRepository } from "../modules/recurring/in-memory-recurring.repository";
import { InMemoryUserRepository } from "../modules/users/in-memory-user.repository";

/**
 * Builds the real Express app wired to fresh in-memory repositories, so tests
 * never need MySQL. When createApp gains a new required store, add its
 * in-memory implementation here once instead of in every test file.
 */
export function createTestApp(configOverrides: Partial<AppConfig> = {}) {
  return createApp(
    {
      jwtSecret: "super-secret-test-key",
      jwtExpiresIn: "1h",
      refreshTokenTtlSeconds: 60 * 60,
      refreshRotationThresholdSeconds: 60 * 60 * 24,
      nodeEnv: "test",
      ...configOverrides
    },
    {
      expenseRepository: new InMemoryExpenseRepository(),
      incomeRepository: new InMemoryIncomeRepository(),
      recurringRepository: new InMemoryRecurringExpenseRepository(),
      refreshTokenRepository: new InMemoryRefreshTokenRepository(),
      userRepository: new InMemoryUserRepository()
    }
  );
}
