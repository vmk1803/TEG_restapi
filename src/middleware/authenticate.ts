import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";
import type { AuthService } from "../modules/auth/auth.service";

export function authenticate(authService: AuthService) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const authorization = request.header("authorization");

    if (!authorization) {
      next(new HttpError(401, "Authentication required."));
      return;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      next(new HttpError(401, "Authorization header must use Bearer token format."));
      return;
    }

    const payload = authService.verifyToken(token);
    request.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role
    };

    next();
  };
}
