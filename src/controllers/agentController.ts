import { Request, Response } from "express";
import { processQuery } from "../services/agentService";
import { logAgent, logError } from "../utils/logger";

export async function handleQuery(req: Request, res: Response): Promise<void> {
  const requestId = (req.headers["x-request-id"] as string) || "unknown";

  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      logAgent(
        `Invalid query format received: ${JSON.stringify(req.body)}`,
        "warn"
      );
      res.status(400).json({
        error: "Invalid request. Query parameter must be a non-empty string.",
      });
      return;
    }

    logAgent(
      `Processing query: "${query.substring(0, 100)}${
        query.length > 100 ? "..." : ""
      }"`
    );
    const result = await processQuery(query);
    logAgent(
      `Query processed successfully: "${query.substring(0, 50)}${
        query.length > 50 ? "..." : ""
      }"`,
      "debug"
    );

    res.status(200).json(result);
  } catch (error: any) {
    logError("Agent Controller", error);
    res.status(500).json({
      error: "An error occurred while processing your query.",
      message: error.message,
      requestId,
    });
  }
}
