import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import * as fs from "fs";
import * as path from "path";
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
      title: doc.metadata.title || "Unknown Title",
      url: doc.metadata.url || "",
      date: doc.metadata.date || "",
    }));

    return { docs: results, sources };
  } catch (error: unknown) {
    logError("Vector DB Query", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to query vector database: ${errorMessage}`);
  }
}
