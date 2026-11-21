import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import type { AuthService } from "../auth/auth.service";
import { parseExpenseRequestSchema } from "./smart-add.schemas";
import type { SmartAddService } from "./smart-add.service";

/** Mounted at /api/expenses/parse. */
export function createSmartAddRouter(authService: AuthService, smartAddService: SmartAddService): Router {
  const router = Router();

  router.use(authenticate(authService));

  router.post("/", async (request, response, next) => {
    try {
      const { text, today } = parseExpenseRequestSchema.parse(request.body);
      const parsed = await smartAddService.parseExpense({
        userId: request.auth!.userId,
        text,
        today
      });

      response.status(200).json({ parsed });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
