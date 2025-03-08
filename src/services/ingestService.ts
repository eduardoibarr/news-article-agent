import { v4 as uuidv4 } from "uuid";
import {
  fetchHtmlContent,
  extractTextFromHtml,
  cleanAndStructureContent,
} from "../utils/contentExtractor";
import { addArticleToVectorDB } from "./vectorDBService";
import logger from "../utils/logger";

export async function ingestArticleFromUrl(url: string) {
  try {
    logger.info("Ingesting article", { url });

    // 1. Fetch HTML content
    const html = await fetchHtmlContent(url);

    // 2. Extract text from HTML
    const extractedText = await extractTextFromHtml(html);

    // 3. Clean and structure the content
    const { id, title, content, summary, publishedAt, source, createdAt } =
      await cleanAndStructureContent(extractedText, url);

    // 4. Create article object
    const article = {
      id: id || uuidv4(),
      url,
      title,
      content,
      summary,
      source: source || new URL(url).hostname,
      publishedAt: publishedAt || new Date().toISOString(),
      createdAt: createdAt || new Date().toISOString(),
    };

    // 5. Add to vector database
    await addArticleToVectorDB(article);

    logger.info("Article ingested successfully", { url, id: article.id });

    return article;
  } catch (error: unknown) {
    logger.error("Failed to ingest article", { url, error });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to ingest article from ${url}: ${errorMessage}`);
  }
}
