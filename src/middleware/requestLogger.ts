import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = uuidv4();
  req.headers["x-request-id"] = requestId;

  const start = Date.now();

  logger.http(
    `${requestId} => ${req.method} ${req.originalUrl} | IP: ${
      req.ip
    } | User-Agent: ${req.get("user-agent") || "unknown"}`
  );

  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };

    ["password", "token", "apiKey"].forEach((field) => {
      if (sanitizedBody[field]) sanitizedBody[field] = "[REDACTED]";
    });

    logger.debug(
      `${requestId} => Request Body: ${JSON.stringify(sanitizedBody)}`
    );
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusText = res.statusMessage || "";
    const level = status >= 400 ? "warn" : "http";

    logger.log({
      level,
      message: `${requestId} <= ${req.method} ${req.originalUrl} | ${status} ${statusText} | ${duration}ms`,
    });
  });

  next();
}

export default requestLogger;
