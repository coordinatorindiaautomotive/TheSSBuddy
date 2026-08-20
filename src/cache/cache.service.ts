// src/cache/cache.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CACHE_NAMESPACE, REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Get a cached value by key.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = CACHE_NAMESPACE + key;
      const data = await this.redis.get(fullKey);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error: any) {
      this.logger.warn(`Cache get failed for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set a cached value with optional TTL and tags.
   * Tags allow group invalidation (e.g., by branch, by period).
   */
  async set(key: string, value: any, ttlSeconds: number = this.DEFAULT_TTL, tags?: string[]): Promise<void> {
    try {
      const fullKey = CACHE_NAMESPACE + key;
      const pipeline = this.redis.pipeline();

      pipeline.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);

      // Register tags: maintain a SET per tag containing all keys with that tag
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          const tagKey = CACHE_NAMESPACE + 'tag:' + tag;
          pipeline.sadd(tagKey, fullKey);
          // Tag sets don't need long TTL — they're managed alongside cache entries
          pipeline.expire(tagKey, ttlSeconds + 60);
        }
      }

      await pipeline.exec();
    } catch (error: any) {
      this.logger.warn(`Cache set failed for key ${key}: ${error.message}`);
    }
  }

  /**
   * Invalidate all cache entries with a specific tag.
   * This is the PRIMARY invalidation mechanism — never rely on TTL alone for financial data.
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const tagKey = CACHE_NAMESPACE + 'tag:' + tag;
      const keys = await this.redis.smembers(tagKey);

      if (keys.length === 0) return 0;

      const pipeline = this.redis.pipeline();
      for (const key of keys) {
        pipeline.del(key);
      }
      pipeline.del(tagKey);
      await pipeline.exec();

      this.logger.debug(`Invalidated ${keys.length} cache entries for tag: ${tag}`);
      return keys.length;
    } catch (error: any) {
      this.logger.warn(`Cache invalidation failed for tag ${tag}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Invalidate multiple tags at once (e.g., when a write affects branch + period).
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    await Promise.all(tags.map((tag) => this.invalidateByTag(tag)));
  }

  /**
   * Build standard cache tags for branch + period combinations.
   */
  static buildBranchPeriodTags(branchCode: string | null, year: number, month: number): string[] {
    const tags = [`period:${year}-${month}`];
    if (branchCode) {
      tags.push(`branch:${branchCode}`);
      tags.push(`branch:${branchCode}:period:${year}-${month}`);
    }
    return tags;
  }

  /**
   * Delete a specific cache key.
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(CACHE_NAMESPACE + key);
    } catch (error: any) {
      this.logger.warn(`Cache del failed for key ${key}: ${error.message}`);
    }
  }

  /**
   * Clear ALL application cache (use with extreme caution).
   */
  async flushAll(): Promise<void> {
    try {
      const keys = await this.redis.keys(CACHE_NAMESPACE + '*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.warn(`Flushed ${keys.length} cache entries`);
      }
    } catch (error: any) {
      this.logger.error(`Cache flush failed: ${error.message}`);
    }
  }
}