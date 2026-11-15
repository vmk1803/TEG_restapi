import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import type { AuthService } from "../auth/auth.service";
import { getRuleCatalog } from "./personalization.catalog";

export function createPersonalizationRouter(authService: AuthService): Router {
  const router = Router();

  router.use(authenticate(authService));

  router.get("/rule-catalog", (_request, response) => {
    response.status(200).json(getRuleCatalog());
  });

  return router;
}
