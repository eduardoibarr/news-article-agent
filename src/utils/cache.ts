import logger from "./logger";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Simple in-memory cache implementation for GraphQL resolvers
 * to improve response times for frequently requested data
 */
class ResolverCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      logger.debug("Cache entry expired", { key });
      this.cache.delete(key);
      return undefined;
    }

    logger.debug("Cache hit", { key });
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    logger.debug("Cache set", { key, ttlMs });
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  remove(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = 5 * 60 * 1000
  ): Promise<T> {
    const cachedValue = this.get<T>(key);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const startTime = Date.now();
    logger.debug("Cache miss, executing function", { key });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      logger.debug("Caching function result", {
        key,
        duration: `${duration}ms`,
      });
      this.set(key, result, ttlMs);

      return result;
    } catch (error) {
      logger.error("Error executing cached function", { key, error });
      throw error;
    }
  }
}

export const cache = new ResolverCache();
export default cache;
