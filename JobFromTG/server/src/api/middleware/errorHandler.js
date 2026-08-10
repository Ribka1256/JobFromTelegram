/**
 * src/api/middleware/errorHandler.js
 * Global error handler — must be registered LAST in Express middleware chain.
 * Catches all errors passed via next(err) from any route or middleware.
 */

import { config } from "../../config/index.js";

export function errorHandler(err, req, res, next) {
  // Prisma known request errors (e.g. unique constraint, not found)
  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      error: {
        code:    "DUPLICATE_ENTRY",
        message: "A record with this data already exists.",
        field:   err.meta?.target,
      },
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      error: {
        code:    "NOT_FOUND",
        message: "The requested record was not found.",
      },
    });
  }

  // Zod / express-validator errors
  if (err.name === "ZodError") {
    return res.status(400).json({
      success: false,
      error: {
        code:    "VALIDATION_ERROR",
        message: "Invalid request data.",
        issues:  err.issues,
      },
    });
  }

  // SyntaxError — malformed JSON body
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({
      success: false,
      error: {
        code:    "INVALID_JSON",
        message: "Request body contains invalid JSON.",
      },
    });
  }

  // Generic / unhandled errors
  const statusCode = err.statusCode || err.status || 500;
  const message    = err.message || "Internal server error.";

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  return res.status(statusCode).json({
    success: false,
    error: {
      code:    "INTERNAL_ERROR",
      message: config.isDev ? message : "An unexpected error occurred.",
      // Only expose stack trace in development
      ...(config.isDev && { stack: err.stack }),
    },
  });
}
