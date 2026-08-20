// src/redis/redis.module.ts
import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const CACHE_NAMESPACE = 'ip:cache:';
export const LOCK_NAMESPACE = 'ip:lock:';

export class MockRedis {
  private store = new Map<string, string>();
  private sets = new Map<string, Set<string>>();

  async get(key: string) {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, mode?: string, duration?: number) {
    this.store.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]) {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted++;
      if (this.sets.delete(key)) deleted++;
    }
    return deleted;
  }

  async keys(pattern: string) {
    const prefix = pattern.replace('*', '');
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }

  async smembers(key: string) {
    const s = this.sets.get(key);
    return s ? Array.from(s) : [];
  }

  pipeline() {
    const self = this;
    const commands: Array<() => Promise<any>> = [];
    return {
      set(key: string, value: string, mode?: string, duration?: number) {
        commands.push(async () => self.set(key, value, mode, duration));
        return this;
      },
      sadd(key: string, member: string) {
        commands.push(async () => {
          let s = self.sets.get(key);
          if (!s) {
            s = new Set();
            self.sets.set(key, s);
          }
          s.add(member);
        });
        return this;
      },
      expire(key: string, seconds: number) {
        return this;
      },
      del(key: string) {
        commands.push(async () => self.del(key));
        return this;
      },
      async exec() {
        for (const cmd of commands) {
          await cmd();
        }
        return [];
      },
    };
  }

  on(event: string, handler: any) {
    return this;
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        if (process.env.USE_MOCK_REDIS === 'true') {
          console.log('Using in-memory MockRedis Client (no Redis server required)');
          return new MockRedis();
        }

        const redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: null,
          lazyConnect: true,
          retryStrategy(times) {
            const delay = Math.min(times * 200, 5000);
            return delay;
          },
        });
        return redis;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}