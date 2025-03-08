import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { config } from "../config/env";
import {
  fetchHtmlContent,
  extractTextFromHtml,
} from "../utils/contentExtractor";
import logger from "../utils/logger";

const model = new ChatOpenAI({
  apiKey: config.openai.apiKey,
  modelName: "gpt-3.5-turbo",
});

export async function summarizeArticle(url: string): Promise<string> {
  try {
    logger.info("Summarizing article", { url });

    const html = await fetchHtmlContent(url);

    const extractedText = await extractTextFromHtml(html);

    const maxLength = 4000;
    const truncatedText =
      extractedText.length > maxLength
        ? extractedText.substring(0, maxLength)
        : extractedText;

    const summaryPrompt = PromptTemplate.fromTemplate(`
      You are a professional news editor tasked with creating concise summaries.
      Below is the content of a news article. Please summarize it in about 3-4 paragraphs.
      Focus on the key facts, events, and implications. Maintain a neutral tone.
      
      Article content:
      {content}
      
      Summary:
    `);

    const formattedPrompt = await summaryPrompt.format({
      content: truncatedText,
    });
    const response = await model.invoke(formattedPrompt);

    const summary = response.content.toString().trim();
    logger.info("Article summarized successfully", {
      url,
      summaryLength: summary.length,
    });

    return summary;
  } catch (error: unknown) {
    logger.error("Failed to summarize article", { url, error });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to summarize article from ${url}: ${errorMessage}`);
  }
}
