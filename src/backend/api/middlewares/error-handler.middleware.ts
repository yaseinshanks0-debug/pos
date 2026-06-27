// src/backend/api/middlewares/error-handler.middleware.ts

import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { BaseException } from "../../domain/exceptions.ts";
import { ApiResponse } from "../../application/dtos/dtos.ts";

export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const timestamp = new Date().toISOString();

  // If it is a known Domain Exception, map it directly
  if (err instanceof BaseException) {
    console.error("Domain Exception occurred:", err.message, "Errors:", JSON.stringify((err as any).errors));
    const response: ApiResponse = {
      success: false,
      message: err.message,
      errors: (err as any).errors || undefined,
      timestamp,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle specialized Drizzle/Postgres duplicate key constraints
  if (err.code === "23505") { // Unique violation
    const response: ApiResponse = {
      success: false,
      message: "A database constraint conflict occurred. Entity name or key already exists.",
      timestamp,
    };
    res.status(409).json(response);
    return;
  }

  // Handle foreign key constraint violations
  if (err.code === "23503") { // ForeignKey violation
    const response: ApiResponse = {
      success: false,
      message: "Database Reference Integrity Failed. Referencing block does not exist.",
      timestamp,
    };
    res.status(400).json(response);
    return;
  }

  // Default to General server failure (500)
  console.error("Unhandled Global API Error:", err);
  const response: ApiResponse = {
    success: false,
    message: "An internal server error occurred. Please contact the administrator.",
    timestamp,
  };
  res.status(500).json(response);
};
