import { Router, type CookieOptions, type Request, type Response } from "express";
import type { AuthService, AuthSession } from "./auth.service";
import { changePasswordSchema, loginSchema, signupSchema } from "./auth.schemas";
import { authenticate } from "../../middleware/authenticate";
import { HttpError } from "../../lib/http-error";
import { AuthErrorCode } from "./auth.error-codes";

export type RefreshCookieConfig = {
  ttlSeconds: number;
  secure: boolean;
};

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/auth";

function buildCookieOptions(config: RefreshCookieConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.secure,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    maxAge: config.ttlSeconds * 1000
  };
}

function applySession(
  response: Response,
  session: AuthSession,
  cookieConfig: RefreshCookieConfig
): { accessToken: string; user: AuthSession["user"] } {
  if (session.refreshToken !== null) {
    response.cookie(REFRESH_COOKIE_NAME, session.refreshToken, buildCookieOptions(cookieConfig));
  }

  return {
    accessToken: session.accessToken,
    user: session.user
  };
}

function readRefreshCookie(request: Request): string {
  const value = request.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(
      401,
      "Refresh token cookie is missing.",
      AuthErrorCode.REFRESH_COOKIE_MISSING
    );
  }
  return value;
}

export function createAuthRouter(
  authService: AuthService,
  cookieConfig: RefreshCookieConfig
): Router {
  const router = Router();
  const requireAuth = authenticate(authService);

  router.post("/signup", async (request, response, next) => {
    try {
      const payload = signupSchema.parse(request.body);
      const session = await authService.signup(payload);
      response.status(201).json(applySession(response, session, cookieConfig));
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (request, response, next) => {
    try {
      const payload = loginSchema.parse(request.body);
      const session = await authService.loginWithCredentials(payload);
      response.status(200).json(applySession(response, session, cookieConfig));
    } catch (error) {
      next(error);
    }
  });

  router.post("/refresh", async (request, response, next) => {
    try {
      const refreshToken = readRefreshCookie(request);
      const session = await authService.refresh(refreshToken);
      response.status(200).json(applySession(response, session, cookieConfig));
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", async (request, response, next) => {
    try {
      const cookieValue = request.cookies?.[REFRESH_COOKIE_NAME];
      if (typeof cookieValue === "string" && cookieValue.length > 0) {
        await authService.logout(cookieValue);
      }
      response.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth, async (request, response, next) => {
    try {
      const user = await authService.getSafeUser(request.auth!.userId);
      response.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.post("/change-password", requireAuth, async (request, response, next) => {
    try {
      const payload = changePasswordSchema.parse(request.body);
      await authService.changePassword({
        userId: request.auth!.userId,
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword
      });

      response.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
