import { Source as ArticleSource } from "../../models/article";
import { getAnswer } from "../../services/agentService";
import { ingestArticleFromUrl } from "../../services/ingestService";
import { summarizeArticle as summarizeArticleService } from "../../services/summarizationService";
import {
  searchArticles as searchArticlesService,
  getArticleById,
} from "../../services/vectorDBService";
import logger from "../../utils/logger";
import cache from "../../utils/cache";

export const resolvers = {
  Query: {
    answerQuery: async (_: any, { query }: { query: string }) => {
      try {
        const cacheKey = `query:${query}`;

        return await cache.getOrSet(cacheKey, async () => {
          const result = await getAnswer(query);
          return {
            answer: result.answer,
            sources: result.sources.map((source: ArticleSource) => ({
              id: source.id,
              url: source.url,
              title: source.title || "Unknown",
            })),
          };
        });
      } catch (error) {
        logger.error("GraphQL Query - answerQuery error", { error, query });
        throw new Error("Failed to process query");
      }
    },

    searchArticles: async (
      _: any,
      { term, limit = 10 }: { term: string; limit?: number }
    ) => {
      try {
        const cacheKey = `search:${term}:${limit}`;

        return await cache.getOrSet(
          cacheKey,
          async () => {
            return await searchArticlesService(term, limit);
          },
          15 * 60 * 1000
        );
      } catch (error) {
        logger.error("GraphQL Query - searchArticles error", { error, term });
        throw new Error("Failed to search articles");
      }
    },

    getArticle: async (_: any, { id }: { id: string }) => {
      try {
        const cacheKey = `article:${id}`;

        return await cache.getOrSet(
          cacheKey,
          async () => {
            return await getArticleById(id);
          },
          30 * 60 * 1000
        );
      } catch (error) {
        logger.error("GraphQL Query - getArticle error", { error, id });
        throw new Error("Failed to get article");
      }
    },
  },

  Mutation: {
    ingestArticle: async (_: any, { url }: { url: string }) => {
      try {
        const article = await ingestArticleFromUrl(url);

        cache.clear();

        return article;
      } catch (error) {
        logger.error("GraphQL Mutation - ingestArticle error", { error, url });
        throw new Error("Failed to ingest article");
      }
    },

    summarizeArticle: async (_: any, { url }: { url: string }) => {
      try {
        const cacheKey = `summary:${url}`;

        return await cache.getOrSet(
          cacheKey,
          async () => {
            const summary = await summarizeArticleService(url);
            return {
              summary,
              url,
            };
          },
          60 * 60 * 1000
        );
      } catch (error) {
        logger.error("GraphQL Mutation - summarizeArticle error", {
          error,
          url,
        });
        throw new Error("Failed to summarize article");
      }
    },
  },
};
