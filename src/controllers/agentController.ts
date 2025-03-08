import { Request, Response } from "express";
import {
  processQuery,
  processQueryWithStreaming,
  summarizeArticle,
} from "../services/agentService";
import { logAgent, logError } from "../utils/logger";
import { Source } from "../models/article";

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

    const acceptsStreaming = req.headers["accept-streaming"] === "true";

    logAgent(
      `Processing query: "${query.substring(0, 100)}${
        query.length > 100 ? "..." : ""
      }"${acceptsStreaming ? " (streaming)" : ""}`
    );

    if (acceptsStreaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      await processQueryWithStreaming(query, {
        onToken: (token: string) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        },
        onComplete: (result: any) => {
          res.write(
            `data: ${JSON.stringify({ complete: true, ...result })}\n\n`
          );
          res.end();
        },
        onError: (error: Error) => {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        },
      });
    } else {
      const result = await processQuery(query);

      const formattedSources = result.sources.map((source) => ({
        title: source.title || "Unknown Title",
        url: source.url,
        date: source.date || new Date().toISOString(),
      }));

      res.status(200).json({
        answer: result.answer,
        sources: formattedSources,
      });
    }

    logAgent(
      `Query processed successfully: "${query.substring(0, 50)}${
        query.length > 50 ? "..." : ""
      }"`,
      "debug"
    );
  } catch (error: any) {
    logError("Agent Controller", error);
    res.status(500).json({
      error: "An error occurred while processing your query.",
      message: error.message,
      requestId,
    });
  }
}

export async function handleSummarize(
  req: Request,
  res: Response
): Promise<void> {
  const requestId = (req.headers["x-request-id"] as string) || "unknown";

  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      logAgent(
        `Invalid summarize request format: ${JSON.stringify(req.body)}`,
        "warn"
      );
      res.status(400).json({
        error: "Invalid request. URL parameter must be a non-empty string.",
      });
      return;
    }

    const acceptsStreaming = req.headers["accept-streaming"] === "true";

    logAgent(
      `Summarizing article: "${url.substring(0, 100)}${
        url.length > 100 ? "..." : ""
      }"${acceptsStreaming ? " (streaming)" : ""}`
    );

    if (acceptsStreaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      await processQueryWithStreaming(`Summarize this article: ${url}`, {
        onToken: (token: string) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        },
        onComplete: (result: any) => {
          res.write(
            `data: ${JSON.stringify({ complete: true, ...result })}\n\n`
          );
          res.end();
        },
        onError: (error: Error) => {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        },
      });
    } else {
      const result = await summarizeArticle(url);

      const formattedSources = result.sources.map((source: Source) => ({
        title: source.title || "Unknown Title",
        url: source.url,
        date: source.date || new Date().toISOString(),
      }));

      res.status(200).json({
        answer: result.answer,
        sources: formattedSources,
      });
    }

    logAgent(`Article summarized successfully: "${url}"`, "debug");
  } catch (error: any) {
    logError("Summarize Controller", error);
    res.status(500).json({
      error: "An error occurred while summarizing the article.",
      message: error.message,
      requestId,
    });
  }
}
