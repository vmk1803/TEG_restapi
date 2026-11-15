import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import type { Pool } from "mysql2/promise";
import { createMySqlPool, ensureDatabaseSchema } from "./db/mysql";
import { errorHandler } from "./middleware/error-handler";
import { createAdminRouter } from "./modules/admin/admin.routes";
import { createAuthRouter, type RefreshCookieConfig } from "./modules/auth/auth.routes";
import { AuthService } from "./modules/auth/auth.service";
import { MySqlRefreshTokenRepository } from "./modules/auth/refresh-token.repository";
import type { RefreshTokenStore } from "./modules/auth/refresh-token.store";
import { createExpenseRouter } from "./modules/expense/expense.routes";
import { MySqlExpenseRepository } from "./modules/expense/expense.repository";
import { ExpenseService } from "./modules/expense/expense.service";
import type { ExpenseStore } from "./modules/expense/expense.store";
import { createIncomeRouter } from "./modules/income/income.routes";
import { IncomeService } from "./modules/income/income.service";
import type { IncomeStore } from "./modules/income/income.store";
import { MySqlIncomeRepository } from "./modules/income/income.repository";
import { createOverviewRouter } from "./modules/overview/overview.routes";
import { OverviewService } from "./modules/overview/overview.service";
import { createPersonalizationRouter } from "./modules/personalization/personalization.routes";
import { createRecurringRouter } from "./modules/recurring/recurring.routes";
import { MySqlRecurringExpenseRepository } from "./modules/recurring/recurring.repository";
import { RecurringExpenseService } from "./modules/recurring/recurring.service";
import type { RecurringExpenseStore } from "./modules/recurring/recurring.store";
import type { UserStore } from "./modules/users/user.store";
import { MySqlUserRepository } from "./modules/users/user.repository";
import { currentYearMonth, generateRecurringExpensesForMonth } from "./jobs/recurring-expenses-job";

export type AppConfig = {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenTtlSeconds: number;
  refreshRotationThresholdSeconds: number;
  nodeEnv: "development" | "test" | "production";
  databaseUrl?: string;
};

type AppDependencies = {
  expenseRepository?: ExpenseStore;
  pool?: Pool;
  incomeRepository?: IncomeStore;
  recurringRepository?: RecurringExpenseStore;
  refreshTokenRepository?: RefreshTokenStore;
  userRepository?: UserStore;
};

export type AppContext = {
  app: express.Express;
  pool: Pool | null;
  authService: AuthService;
  expenseRepository: ExpenseStore;
  expenseService: ExpenseService;
  incomeRepository: IncomeStore;
  incomeService: IncomeService;
  recurringRepository: RecurringExpenseStore;
  recurringService: RecurringExpenseService;
  overviewService: OverviewService;
  refreshTokenRepository: RefreshTokenStore;
  userRepository: UserStore;
  initialize: () => Promise<void>;
  runRecurringCatchUp: () => Promise<{ created: number; skipped: number }>;
  close: () => Promise<void>;
};

export function createApp(config: AppConfig, dependencies: AppDependencies = {}): AppContext {
  const pool = dependencies.pool ?? (config.databaseUrl ? createMySqlPool(config.databaseUrl) : null);
  const userRepository =
    dependencies.userRepository ??
    (pool ? new MySqlUserRepository(pool) : null);
  const refreshTokenRepository =
    dependencies.refreshTokenRepository ??
    (pool ? new MySqlRefreshTokenRepository(pool) : null);
  const expenseRepository =
    dependencies.expenseRepository ??
    (pool ? new MySqlExpenseRepository(pool) : null);
  const incomeRepository =
    dependencies.incomeRepository ??
    (pool ? new MySqlIncomeRepository(pool) : null);
  const recurringRepository =
    dependencies.recurringRepository ??
    (pool ? new MySqlRecurringExpenseRepository(pool) : null);

  if (!userRepository || !refreshTokenRepository || !incomeRepository || !expenseRepository || !recurringRepository) {
    throw new Error(
      "User, refresh token, income, expense, and recurring-expense repositories or MySQL database configuration are required."
    );
  }

  const authService = new AuthService(userRepository, refreshTokenRepository, {
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.jwtExpiresIn,
    refreshTokenTtlSeconds: config.refreshTokenTtlSeconds,
    refreshRotationThresholdSeconds: config.refreshRotationThresholdSeconds
  });
  const expenseService = new ExpenseService(expenseRepository);
  const incomeService = new IncomeService(incomeRepository);
  const recurringService = new RecurringExpenseService(recurringRepository, incomeRepository);
  const overviewService = new OverviewService(incomeRepository, expenseRepository);

  const refreshCookieConfig: RefreshCookieConfig = {
    ttlSeconds: config.refreshTokenTtlSeconds,
    secure: config.nodeEnv === "production"
  };

  const app = express();
  app.use(cors({
    origin: "http://localhost:3002",
    credentials: true
  }));
  app.use(helmet());
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_request, response) => {
    response.status(200).json({
      status: "ok"
    });
  });

  app.use("/api/auth", createAuthRouter(authService, refreshCookieConfig));
  app.use("/api/admin", createAdminRouter(authService, userRepository));
  app.use("/api/expenses", createExpenseRouter(authService, expenseService));
  app.use("/api/income", createIncomeRouter(authService, incomeService));
  app.use("/api/recurring", createRecurringRouter(authService, recurringService));
  app.use("/api/overview", createOverviewRouter(authService, overviewService));
  app.use("/api/personalization", createPersonalizationRouter(authService));

  app.use(errorHandler);

  return {
    app,
    pool,
    authService,
    expenseRepository,
    expenseService,
    incomeRepository,
    incomeService,
    recurringRepository,
    recurringService,
    overviewService,
    refreshTokenRepository,
    userRepository,
    initialize: async () => {
      if (pool) {
        await ensureDatabaseSchema(pool);
      }
    },
    runRecurringCatchUp: async () => {
      const { year, month } = currentYearMonth();
      return generateRecurringExpensesForMonth(recurringRepository, expenseRepository, year, month);
    },
    close: async () => {
      await pool?.end();
    }
  };
}
