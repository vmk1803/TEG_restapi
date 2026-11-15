import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import type { AuthService } from "../auth/auth.service";
import {
  recurringExpenseIdParamSchema,
  recurringExpensePayloadSchema
} from "./recurring.schemas";
import type { RecurringExpenseService } from "./recurring.service";

export function createRecurringRouter(
  authService: AuthService,
  recurringService: RecurringExpenseService
): Router {
  const router = Router();

  router.use(authenticate(authService));

  router.get("/", async (request, response, next) => {
    try {
      const recurring = await recurringService.listRecurring(request.auth!.userId);
      response.status(200).json({ recurring });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const payload = recurringExpensePayloadSchema.parse(request.body);
      const recurring = await recurringService.createRecurring({
        userId: request.auth!.userId,
        category: payload.category,
        description: payload.description,
        amount: payload.amount
      });
      response.status(201).json({ recurring });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:recurringId", async (request, response, next) => {
    try {
      const { recurringId } = recurringExpenseIdParamSchema.parse(request.params);
      await recurringService.deleteRecurring(request.auth!.userId, recurringId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
