import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import type { AuthService } from "../auth/auth.service";
import type { OverviewService } from "./overview.service";

export function createOverviewRouter(
  authService: AuthService,
  overviewService: OverviewService
): Router {
  const router = Router();

  router.use(authenticate(authService));

  router.get("/", async (request, response, next) => {
    try {
      const overview = await overviewService.getOverview(request.auth!.userId);
      response.status(200).json(overview);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
