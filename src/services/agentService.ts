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

const streamingModel = new ChatOpenAI({
  apiKey: config.openai.apiKey,
  modelName: "gpt-3.5-turbo",
  streaming: true,
});

export interface StreamingCallbacks {
  onToken: (token: string) => void;
  onComplete: (result: AgentResponse) => void;
  onError: (error: Error) => void;
}

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

export async function processQueryWithStreaming(
  query: string,
  callbacks: StreamingCallbacks
): Promise<void> {
  try {
    const url = extractUrlFromQuery(query);

    let contextDocs;
    let sources = [];

    if (url) {
      logAgent(`Processing URL-specific query with streaming for: ${url}`);
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

        sources = [
          {
            id: uuidv4(),
            title: article.title,
            url: article.url,
            date: article.date,
          },
        ];

        let responseText = "";

        await streamingModel.invoke(formattedPrompt, {
          callbacks: [
            {
              handleLLMNewToken: (token) => {
                responseText += token;
                callbacks.onToken(token);
              },
            },
          ],
        });

        const result: AgentResponse = {
          answer: responseText,
          sources,
        };

        callbacks.onComplete(result);
      } catch (error: any) {
        logError("URL Query Streaming", error);
        callbacks.onError(error);
      }
    } else {
      logAgent(`Processing general knowledge query with streaming: ${query}`);
      try {
        const { docs, sources: querySources } = await queryVectorDB(query, 3);
        sources = querySources;

        if (docs.length === 0) {
          const result: AgentResponse = {
            answer:
              "I don't have any information about that topic in my knowledge base. Try asking about a different topic or providing a URL to an article.",
            sources: [],
          };
          callbacks.onComplete(result);
          return;
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

        let responseText = "";

        await streamingModel.invoke(formattedPrompt, {
          callbacks: [
            {
              handleLLMNewToken: (token) => {
                responseText += token;
                callbacks.onToken(token);
              },
            },
          ],
        });

        const result: AgentResponse = {
          answer: responseText,
          sources,
        };

        callbacks.onComplete(result);
      } catch (error: any) {
        logError("General Query Streaming", error);
        callbacks.onError(error);
      }
    }
  } catch (error: any) {
    logError("Query Streaming", error);
    callbacks.onError(error);
  }
}

/**
 * Summarize an article from a given URL
 * @param url URL do artigo a ser summarizado
 * @returns Resposta contendo o resumo e informações sobre a fonte
 */
export async function summarizeArticle(url: string): Promise<AgentResponse> {
  try {
    logAgent(`Summarizing article from URL: ${url}`);

    try {
      new URL(url);
    } catch (urlError) {
      throw new Error(`Invalid URL format: ${url}`);
    }

    try {
      const htmlContent = await fetchHtmlContent(url);
      const textContent = extractTextFromHtml(htmlContent);
      const article = await cleanAndStructureContent(url, textContent);

      try {
        const { storeArticle } = await import("./vectorDBService");
        await storeArticle(article);
        logAgent(`Article stored in vector DB: ${url}`);
      } catch (storeError) {
        logAgent("Failed to store article in vector DB", "warn");
      }

      const promptTemplate = PromptTemplate.fromTemplate(`
        You are a professional news summarizer.
        
        ARTICLE INFORMATION:
        Title: {title}
        Content: {content}
        URL: {url}
        Date: {date}
        
        Task: Create a concise, informative summary of the article above. 
        Include the main points, key facts, and any important context.
        Keep the summary to 3-5 paragraphs.
      `);

      const formattedPrompt = await promptTemplate.format({
        title: article.title,
        content: article.content,
        url: article.url,
        date: article.date,
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
      logError("Article Summarization", error);
      throw new Error(`Failed to summarize article: ${error.message}`);
    }
  } catch (error: any) {
    logError("Summarize Service", error);

    return {
      answer: `I encountered an error while summarizing the article: ${error.message}. Please check the URL and try again.`,
      sources: [],
    };
  }
}
