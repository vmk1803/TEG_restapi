import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    response.status(400).json({
      code: "VALIDATION_FAILED",
      message: "Validation failed.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      ...(error.code ? { code: error.code } : {}),
      message: error.message
    });
    return;
  }

  console.error(error);

  response.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Something went wrong."
  });
}
