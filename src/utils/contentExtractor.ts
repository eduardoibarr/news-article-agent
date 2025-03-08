import axios from "axios";
import * as cheerio from "cheerio";
import { CleanedArticle } from "../models/article";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "../config/env";
import { logServer, logError } from "./logger";

export async function fetchHtmlContent(url: string): Promise<string> {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1",
  ];

  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  const timeout = 10000;

  try {
    logServer(`Fetching content from: ${url}`);

    const headers = {
      "User-Agent": userAgent,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      Referer: "https://www.google.com/",
      DNT: "1",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    };

    const response = await axios.get(url, {
      headers,
      timeout,
      maxRedirects: 5,
    });

    return response.data;
  } catch (error: any) {
    logError(
      "Content Extractor",
      `Error fetching content from ${url}: ${error}`
    );

    if (error.response) {
      const status = error.response.status;
      if (status === 403 || status === 401) {
        throw new Error(
          `Access denied (${status}) - Website is blocking scrapers: ${url}`
        );
      } else if (status === 404) {
        throw new Error(`Page not found (404): ${url}`);
      } else if (status === 429) {
        throw new Error(`Rate limited (429) - Too many requests to: ${url}`);
      } else {
        throw new Error(
          `Failed to fetch content from URL (status ${status}): ${url}`
        );
      }
    } else if (error.request) {
      throw new Error(
        `No response received from server: ${url}. Check your network connection.`
      );
    } else {
      throw new Error(
        `Failed to fetch content from URL: ${url}. Error: ${error.message}`
      );
    }
  }
}

export function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);

  $("script, style, meta, link").remove();

  const title = $("title").text().trim();

  const articleContent = $("article, .article, .content, main, #content, #main")
    .text()
    .replace(/\\s+/g, " ")
    .trim();

  const bodyText = $("body").text().replace(/\\s+/g, " ").trim();

  const content = articleContent || bodyText;

  return `Title: ${title}\n\nContent: ${content}`;
}

export async function cleanAndStructureContent(
  rawContent: string,
  url: string
): Promise<CleanedArticle> {
  const openai = new ChatOpenAI({
    apiKey: config.openai.apiKey,
    modelName: "gpt-3.5-turbo",
  });

  const currentDate = new Date().toISOString().split("T")[0];

  const prompt = `
  You are a helpful assistant that extracts and cleans news article content.
  
  Below is raw HTML content from a news article. Extract and structure the following information:
  1. The article title
  2. The main article content (cleaned and well-formatted)
  3. A brief summary of the article (2-3 sentences)
  
  Format your response as JSON with the following fields:
  - title: The article's title
  - content: The cleaned article content
  - summary: A brief summary of the article
  
  Raw content:
  ${rawContent.substring(0, 15000)} <!-- Truncate to avoid token limits -->
  `;

  try {
    const response = await openai.invoke(prompt);
    const responseText = response.content.toString();

    const jsonStr =
      responseText.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/)?.[1] ||
      responseText;

    let parsed;
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      const titleMatch = responseText.match(/title[":]*\s*(.*?)[\n",]/i);
      const contentMatch = responseText.match(
        /content[":]*\s*([\s\S]*?)(\n\n|$)/i
      );
      const summaryMatch = responseText.match(
        /summary[":]*\s*([\s\S]*?)(\n\n|$)/i
      );

      parsed = {
        title: titleMatch ? titleMatch[1].trim() : "Untitled Article",
        content: contentMatch
          ? contentMatch[1].trim()
          : rawContent.substring(0, 1000),
        summary: summaryMatch ? summaryMatch[1].trim() : "No summary available",
      };
    }

    const id = Math.random().toString(36).substring(2, 15);

    return {
      id,
      title: parsed.title || "Untitled Article",
      content: parsed.content || rawContent.substring(0, 1000),
      url,
      summary: parsed.summary || "No summary available",
      publishedAt: currentDate,
      source: new URL(url).hostname,
      createdAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    logError("Content Extraction", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError("Failed to clean content", { error: errorMsg });

    const id = Math.random().toString(36).substring(2, 15);

    return {
      id,
      title: "Extraction Failed",
      content: rawContent.substring(0, 5000),
      url,
      summary: "Content extraction failed",
      publishedAt: currentDate,
      source: new URL(url).hostname,
      createdAt: new Date().toISOString(),
    };
  }
}
