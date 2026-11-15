import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import type { AuthService } from "../auth/auth.service";
import { expenseIdParamSchema, expensePayloadSchema } from "./expense.schemas";
import type { ExpenseService } from "./expense.service";

export function createExpenseRouter(authService: AuthService, expenseService: ExpenseService): Router {
  const router = Router();

  router.use(authenticate(authService));

  router.get("/categories", (_request, response) => {
    response.status(200).json({
      categories: expenseService.getCategories()
    });
  });

  router.post("/", async (request, response, next) => {
    try {
      const payload = expensePayloadSchema.parse(request.body);
      const expense = await expenseService.createExpense({
        userId: request.auth!.userId,
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        spentDate: payload.spentDate
      });

      response.status(201).json({ expense });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (request, response, next) => {
    try {
      const expenses = await expenseService.listExpenses(request.auth!.userId);
      response.status(200).json({ expenses });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:expenseId", async (request, response, next) => {
    try {
      const { expenseId } = expenseIdParamSchema.parse(request.params);
      const payload = expensePayloadSchema.parse(request.body);
      const expense = await expenseService.updateExpense({
        userId: request.auth!.userId,
        expenseId,
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        spentDate: payload.spentDate
      });

      response.status(200).json({ expense });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:expenseId", async (request, response, next) => {
    try {
      const { expenseId } = expenseIdParamSchema.parse(request.params);
      await expenseService.deleteExpense(request.auth!.userId, expenseId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
