import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";
import type { Role } from "../modules/users/user.types";

export function requireRole(...roles: Role[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth) {
      next(new HttpError(401, "Authentication required."));
      return;
    }

    if (!roles.includes(request.auth.role)) {
      next(new HttpError(403, "You do not have permission to access this resource."));
      return;
    }

    next();
  };
}
