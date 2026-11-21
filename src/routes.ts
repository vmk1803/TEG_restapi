import type express from "express";
import { createAdminRouter } from "./modules/admin/admin.routes";
import { createAuthRouter, type RefreshCookieConfig } from "./modules/auth/auth.routes";
import type { AuthService } from "./modules/auth/auth.service";
import { createExpenseRouter } from "./modules/expense/expense.routes";
import type { ExpenseService } from "./modules/expense/expense.service";
import { createIncomeRouter } from "./modules/income/income.routes";
import type { IncomeService } from "./modules/income/income.service";
import { createOverviewRouter } from "./modules/overview/overview.routes";
import type { OverviewService } from "./modules/overview/overview.service";
import { createPersonalizationRouter } from "./modules/personalization/personalization.routes";
import { createRecurringRouter } from "./modules/recurring/recurring.routes";
import type { RecurringExpenseService } from "./modules/recurring/recurring.service";
import { createSmartAddRouter } from "./modules/smart-add/smart-add.routes";
import type { SmartAddService } from "./modules/smart-add/smart-add.service";
import type { UserStore } from "./modules/users/user.store";

export type RouteDependencies = {
  authService: AuthService;
  refreshCookieConfig: RefreshCookieConfig;
  userRepository: UserStore;
  expenseService: ExpenseService;
  incomeService: IncomeService;
  recurringService: RecurringExpenseService;
  overviewService: OverviewService;
  smartAddService: SmartAddService;
};

/** Mounts every API route on the app. Call after body/cookie parsers and before the error handler. */
export function registerRoutes(app: express.Express, deps: RouteDependencies): void {
  app.get("/api/health", (_request, response) => {
    response.status(200).json({
      status: "ok"
    });
  });

  app.use("/api/auth", createAuthRouter(deps.authService, deps.refreshCookieConfig));
  app.use("/api/admin", createAdminRouter(deps.authService, deps.userRepository));
  // Before /api/expenses, so /parse doesn't pass through the expense router first.
  app.use("/api/expenses/parse", createSmartAddRouter(deps.authService, deps.smartAddService));
  app.use("/api/expenses", createExpenseRouter(deps.authService, deps.expenseService));
  app.use("/api/income", createIncomeRouter(deps.authService, deps.incomeService));
  app.use("/api/recurring", createRecurringRouter(deps.authService, deps.recurringService));
  app.use("/api/overview", createOverviewRouter(deps.authService, deps.overviewService));
  app.use("/api/personalization", createPersonalizationRouter(deps.authService));
}
