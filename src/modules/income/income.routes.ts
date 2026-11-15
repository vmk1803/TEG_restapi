import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import type { AuthService } from "../auth/auth.service";
import { incomeIdParamSchema, incomePayloadSchema } from "./income.schemas";
import type { IncomeService } from "./income.service";

export function createIncomeRouter(authService: AuthService, incomeService: IncomeService): Router {
  const router = Router();

  router.use(authenticate(authService));

  router.get("/categories", (_request, response) => {
    response.status(200).json({
      categories: incomeService.getCategories()
    });
  });

  router.post("/", async (request, response, next) => {
    try {
      const payload = incomePayloadSchema.parse(request.body);
      const income = await incomeService.createIncome({
        userId: request.auth!.userId,
        totalIncome: payload.totalIncome,
        allocations: payload.allocations
      });

      response.status(201).json({ income });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (request, response, next) => {
    try {
      const incomes = await incomeService.listIncome(request.auth!.userId);
      response.status(200).json({ incomes });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:incomeId", async (request, response, next) => {
    try {
      const { incomeId } = incomeIdParamSchema.parse(request.params);
      const payload = incomePayloadSchema.parse(request.body);
      const income = await incomeService.updateIncome({
        userId: request.auth!.userId,
        incomeId,
        totalIncome: payload.totalIncome,
        allocations: payload.allocations
      });

      response.status(200).json({ income });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:incomeId", async (request, response, next) => {
    try {
      const { incomeId } = incomeIdParamSchema.parse(request.params);
      await incomeService.deleteIncome(request.auth!.userId, incomeId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
