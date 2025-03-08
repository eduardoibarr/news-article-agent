import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { config } from "../config/env";
import { queryVectorDB } from "./vectorDBService";
import { AgentResponse } from "../models/article";
import {
  fetchHtmlContent,
  extractTextFromHtml,
  cleanAndStructureContent,
} from "../utils/contentExtractor";
import { logAgent, logError } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

const model = new ChatOpenAI({
  apiKey: config.openai.apiKey,
  modelName: "gpt-3.5-turbo",
});

function extractUrlFromQuery(query: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = query.match(urlRegex);

  if (match && match.length > 0) {
    return match[0];
  }

  return null;
}

async function processUrlQuery(
  url: string,
  query: string
): Promise<AgentResponse> {
  try {
    const htmlContent = await fetchHtmlContent(url);
    const textContent = extractTextFromHtml(htmlContent);
    const article = await cleanAndStructureContent(url, textContent);

    try {
      const { storeArticle } = await import("./vectorDBService");
      await storeArticle(article);
    } catch (error) {
      logAgent("Failed to store article in vector DB", "warn");
    }

    const promptTemplate = PromptTemplate.fromTemplate(`
      You are a knowledgeable assistant that provides information about news articles.
      
      ARTICLE INFORMATION:
      Title: {title}
      Content: {content}
      URL: {url}
      Date: {date}
      
      USER QUERY:
      {query}
      
      Provide a comprehensive, informative, and accurate response to the user's query based on the article information above.
      Be detailed but concise. If the article doesn't contain information to answer the query, say so clearly.
    `);

    const formattedPrompt = await promptTemplate.format({
      title: article.title,
      content: article.content,
      url: article.url,
      date: article.date,
      query: query.replace(url, "").trim(),
    });

    const response = await model.invoke(formattedPrompt);

    return {
      answer: response.content.toString(),
      sources: [
        {
          id: uuidv4(),
          title: article.title,
          url: article.url,
          date: article.date,
        },
      ],
    };
  } catch (error: any) {
    logError("URL Query Processing", error);
    throw new Error(`Failed to process URL query: ${error.message}`);
  }
}

async function processGeneralQuery(query: string): Promise<AgentResponse> {
  try {
    const { docs, sources } = await queryVectorDB(query, 3);

    if (docs.length === 0) {
      return {
        answer:
          "I don't have any information about that topic in my knowledge base. Try asking about a different topic or providing a URL to an article.",
        sources: [],
      };
    }

    const context = docs
      .map(
        (doc: any, i: number) => `
      ARTICLE ${i + 1}:
      Title: ${doc.metadata.title || "Unknown"}
      Content: ${doc.pageContent.substring(0, 1000)} ${
          doc.pageContent.length > 1000 ? "..." : ""
        }
      URL: ${doc.metadata.url || "Unknown"}
      Date: ${doc.metadata.date || "Unknown"}
    `
      )
      .join("\n\n");

    const promptTemplate = PromptTemplate.fromTemplate(`
      You are a knowledgeable news assistant that provides information based on recent news articles.
      
      CONTEXT FROM RELEVANT ARTICLES:
      {context}
      
      USER QUERY:
      {query}
      
      Provide a comprehensive, informative, and accurate response to the user's query based on the articles provided.
      Only use information from the articles provided as context. If the articles don't contain enough information to fully answer the query, say so clearly.
      Synthesize information from multiple articles if relevant. Be detailed but concise.
    `);

    const formattedPrompt = await promptTemplate.format({
      context,
      query,
    });

    const response = await model.invoke(formattedPrompt);

    return {
      answer: response.content.toString(),
      sources: sources,
    };
  } catch (error: any) {
    logError("General Query Processing", error);
    throw new Error(`Failed to process general query: ${error.message}`);
  }
}

export async function processQuery(query: string): Promise<AgentResponse> {
  try {
    const url = extractUrlFromQuery(query);

    if (url) {
      logAgent(`Processing URL-specific query for: ${url}`);
      return await processUrlQuery(url, query);
    } else {
      logAgent(`Processing general knowledge query: ${query}`);
      return await processGeneralQuery(query);
    }
  } catch (error: any) {
    logError("Query Processing", error);

    return {
      answer: `I encountered an error while processing your query: ${error.message}. Please try again or rephrase your question.`,
      sources: [],
    };
  }
}

export async function getAnswer(query: string): Promise<AgentResponse> {
  logAgent(`Processing query: ${query}`);

  const url = extractUrlFromQuery(query);

  if (url) {
    return processUrlQuery(url, query);
  } else {
    return processGeneralQuery(query);
  }
}
