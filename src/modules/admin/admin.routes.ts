import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/require-role";
import type { AuthService } from "../auth/auth.service";
import type { UserStore } from "../users/user.store";

export function createAdminRouter(
  authService: AuthService,
  userRepository: UserStore
): Router {
  const router = Router();

  router.use(authenticate(authService));
  router.use(requireRole("ADMIN"));

  router.get("/users", async (_request, response, next) => {
    try {
      response.status(200).json({
        users: await userRepository.listSafeUsers()
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
