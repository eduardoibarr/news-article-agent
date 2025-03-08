import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";
import { CleanedArticle, Source } from "../models/article";
import { logDB, logError } from "../utils/logger";

let vectorStore: FaissStore | null = null;
const VECTOR_STORE_PATH = path.join(process.cwd(), "data", "faiss_index");

export async function initVectorDB(): Promise<void> {
  try {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openai.apiKey,
      batchSize: 512,
    });

    if (fs.existsSync(`${VECTOR_STORE_PATH}.faiss`)) {
      logDB("Loading existing FAISS index...");
      vectorStore = await FaissStore.load(VECTOR_STORE_PATH, embeddings);
    } else {
      logDB("Creating new FAISS index...");

      const initialDoc = new Document({
        pageContent: "Initial document for vector store initialization",
        metadata: { source: "initialization" },
      });

      vectorStore = await FaissStore.fromDocuments([initialDoc], embeddings);
      await vectorStore.save(VECTOR_STORE_PATH);
    }

    logDB("Vector database initialized successfully");
  } catch (error: unknown) {
    logError("Vector DB Init", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize vector database: ${errorMessage}`);
  }
}

export async function storeArticle(article: CleanedArticle): Promise<void> {
  try {
    if (!vectorStore) {
      await initVectorDB();
    }

    const doc = new Document({
      pageContent: article.content,
      metadata: {
        title: article.title,
        url: article.url,
        date: article.date,
      },
    });

    await vectorStore!.addDocuments([doc]);
    await vectorStore!.save(VECTOR_STORE_PATH);
    logDB(`Article stored in vector database: ${article.title}`);
  } catch (error: unknown) {
    logError("Vector DB Store", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to store article in vector database: ${errorMessage}`
    );
  }
}

export async function addArticleToVectorDB(article: any): Promise<void> {
  const cleanedArticle: CleanedArticle = {
    id: article.id,
    url: article.url,
    title: article.title,
    content: article.content,
    summary: article.summary,
    publishedAt: article.publishedAt,
    source: article.source,
    createdAt: article.createdAt,
  };

  await storeArticle(cleanedArticle);
}

export async function queryVectorDB(
  query: string,
  numResults: number = 3
): Promise<{ docs: Document[]; sources: Source[] }> {
  try {
    if (!vectorStore) {
      await initVectorDB();
    }

    const results = await vectorStore!.similaritySearch(query, numResults);

    const sources: Source[] = results.map((doc) => ({
      id: doc.metadata.id || doc.metadata.url || uuidv4(),
      title: doc.metadata.title || "Unknown Title",
      url: doc.metadata.url || "",
      date: doc.metadata.date || "",
      content: doc.pageContent,
      source: doc.metadata.source,
      publishedAt: doc.metadata.publishedAt,
      createdAt: doc.metadata.createdAt,
    }));

    return { docs: results, sources };
  } catch (error: unknown) {
    logError("Vector DB Query", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to query vector database: ${errorMessage}`);
  }
}

export async function searchArticles(
  term: string,
  limit: number = 10
): Promise<any[]> {
  if (!vectorStore) {
    await initVectorDB();
  }

  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  const results = await queryVectorDB(term, limit);

  return results.sources.map((source) => ({
    id: source.id,
    url: source.url,
    title: source.title || "Unknown",
    content: source.content || "",
    summary: source.summary || "",
    source: source.source || new URL(source.url).hostname,
    publishedAt: source.publishedAt || new Date().toISOString(),
    createdAt: source.createdAt || new Date().toISOString(),
  }));
}

export async function getArticleById(id: string): Promise<any | null> {
  if (!vectorStore) {
    await initVectorDB();
  }

  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  const results = await vectorStore.similaritySearch("", 100);
  const article = results.find((doc) => doc.metadata.id === id);

  if (!article) {
    return null;
  }

  return {
    id: article.metadata.id,
    url: article.metadata.url,
    title: article.metadata.title || "Unknown",
    content: article.pageContent,
    summary: article.metadata.summary || "",
    source: article.metadata.source || new URL(article.metadata.url).hostname,
    publishedAt: article.metadata.publishedAt || new Date().toISOString(),
    createdAt: article.metadata.createdAt || new Date().toISOString(),
  };
}
