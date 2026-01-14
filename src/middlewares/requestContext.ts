import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

/**
 * Adds/propagates a request correlation id.
 *
 * - Reads incoming header: X-Request-Id
 * - If missing, generates one
 * - Stores it on req/res for downstream usage
 * - Returns it to the client via response header: X-Request-Id
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming =
    (req.header("x-request-id") || req.header("X-Request-Id"))?.trim() || "";
  const requestId = incoming || randomUUID();

  // Attach to request (without global type augmentation to keep it simple)
  (req as any).requestId = requestId;
  res.locals.requestId = requestId;

  // Expose on response
  res.setHeader("X-Request-Id", requestId);

  next();
}



