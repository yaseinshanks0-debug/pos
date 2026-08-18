// src/backend/infrastructure/cache/redis.service.ts

import Redis from "ioredis";
import { ILogger } from "../../application/ports/logger.interface.ts";

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delPattern(pattern: string): Promise<void>;
  isHealthy(): Promise<boolean>;
}

export class RedisCacheService implements ICacheService {
  private client: Redis | null = null;
  private memoryFallback: Map<string, { value: any; expiry: number | null }> = new Map();
  private isRedisConnected = false;

  constructor(private readonly logger?: ILogger) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          lazyConnect: true,
          retryStrategy: (times) => {
            if (times > 3) {
              if (this.logger) this.logger.warn("Redis retry threshold reached; falling back to in-memory cache.");
              return null;
            }
            return Math.min(times * 100, 2000);
          },
          maxRetriesPerRequest: 2,
        });

        this.client.on("connect", () => {
          this.isRedisConnected = true;
          if (this.logger) this.logger.info("Redis cache client connected successfully.");
        });

        this.client.on("error", (err) => {
          this.isRedisConnected = false;
          if (this.logger) this.logger.warn(`Redis client notice: ${err.message}. Using in-memory fallback.`);
        });

        // Attempt non-blocking connection
        this.client.connect().catch(() => {
          this.isRedisConnected = false;
        });
      } catch (err: any) {
        if (this.logger) this.logger.warn(`Redis init failed: ${err.message}. Defaulting to in-memory cache.`);
      }
    } else {
      if (this.logger) this.logger.info("No REDIS_URL provided; initialized in-memory cache adapter.");
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    if (this.client && this.isRedisConnected) {
      try {
        const raw = await this.client.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch (err) {
        if (this.logger) this.logger.warn(`Redis get error for key ${key}: ${err}`);
      }
    }

    // Memory fallback
    const entry = this.memoryFallback.get(key);
    if (!entry) return null;
    if (entry.expiry && entry.expiry < Date.now()) {
      this.memoryFallback.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.client && this.isRedisConnected) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await this.client.set(key, serialized, "EX", ttlSeconds);
        } else {
          await this.client.set(key, serialized);
        }
        return;
      } catch (err) {
        if (this.logger) this.logger.warn(`Redis set error for key ${key}: ${err}`);
      }
    }

    // Memory fallback
    const expiry = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryFallback.set(key, { value, expiry });
  }

  public async del(key: string): Promise<void> {
    if (this.client && this.isRedisConnected) {
      try {
        await this.client.del(key);
      } catch (err) {
        if (this.logger) this.logger.warn(`Redis del error for key ${key}: ${err}`);
      }
    }
    this.memoryFallback.delete(key);
  }

  public async delPattern(pattern: string): Promise<void> {
    if (this.client && this.isRedisConnected) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } catch (err) {
        if (this.logger) this.logger.warn(`Redis delPattern error: ${err}`);
      }
    }

    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
    for (const key of this.memoryFallback.keys()) {
      if (regex.test(key)) {
        this.memoryFallback.delete(key);
      }
    }
  }

  public async isHealthy(): Promise<boolean> {
    if (!this.client || !this.isRedisConnected) return true; // In-memory fallback is always ready
    try {
      const pong = await this.client.ping();
      return pong === "PONG";
    } catch {
      return false;
    }
  }
}
