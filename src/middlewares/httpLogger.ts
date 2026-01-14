import type { NextFunction, Request, Response } from "express";

function nowMs() {
  return Date.now();
}

function getRequestId(req: Request, res: Response): string | undefined {
  return (
    (res.locals as any)?.requestId ||
    (req as any)?.requestId ||
    req.header("x-request-id") ||
    req.header("X-Request-Id") ||
    undefined
  );
}

/**
 * Lightweight structured request logger.
 * Prints one line per request (on finish), including requestId, status and duration.
 */
export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const start = nowMs();
  const requestId = getRequestId(req, res);

  res.on("finish", () => {
    const durationMs = nowMs() - start;
    const log = {
      level: "info",
      msg: "http_request",
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      userAgent: req.header("user-agent"),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(log));
  });

  next();
}



