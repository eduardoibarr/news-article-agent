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
  url: string,
  rawContent: string
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
  3. The publication date (in YYYY-MM-DD format, if available)
  
  Return the result in the following JSON format:
  {
    "title": "Article Title",
    "content": "Cleaned article content...",
    "date": "YYYY-MM-DD"
  }
  
  If the date is not available, use ${currentDate}.
  If the content is too long, summarize it while keeping the key information.
  
  Raw HTML Content:
  ${rawContent}
  `;

  try {
    const response = await openai.invoke(prompt);
    const responseText = response.content.toString();

    let structuredContent;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structuredContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not find JSON in the response");
      }
    } catch (parseError) {
      logError(
        "Content Extractor",
        `Error parsing LLM response: ${parseError}`
      );

      structuredContent = {
        title: "Unknown Title",
        content: responseText.substring(0, 1000),
        date: currentDate,
      };
    }

    return {
      title: structuredContent.title || "Unknown Title",
      content: structuredContent.content || "No content extracted",
      url: url,
      date: structuredContent.date || currentDate,
    };
  } catch (error) {
    logError("Content Extractor", `Error cleaning content with LLM: ${error}`);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to clean and structure content: ${errorMessage}`);
  }
}
