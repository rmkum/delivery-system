import Redis from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface SessionData {
  userId: string;
  tenantId: string;
  role: string;
  loginAt: Date;
}

export class RedisService {
  private static client: Redis.RedisClientType;
  private static isConnected: boolean = false;

  static async initialize() {
    logger.info('Initializing Redis service...');
    
    try {
      this.client = Redis.createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
        },
        password: config.redis.password,
        database: config.redis.db,
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        logger.error('Redis client error', { error });
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting...');
      });

      await this.client.connect();
      
      logger.info('Redis service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis service', { error });
      throw error;
    }
  }

  static async close() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }

  // Session management
  static async setSession(sessionId: string, sessionData: SessionData): Promise<void> {
    const key = this.getKey('session', sessionId);
    const data = JSON.stringify({
      ...sessionData,
      loginAt: sessionData.loginAt.toISOString(),
    });
    
    await this.client.setEx(key, config.jwt.accessTokenTTL, data);
    logger.debug('Session stored', { sessionId, userId: sessionData.userId });
  }

  static async getSession(sessionId: string): Promise<SessionData | null> {
    const key = this.getKey('session', sessionId);
    const data = await this.client.get(key);
    
    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);
    return {
      ...parsed,
      loginAt: new Date(parsed.loginAt),
    };
  }

  static async deleteSession(sessionId: string): Promise<void> {
    const key = this.getKey('session', sessionId);
    await this.client.del(key);
    logger.debug('Session deleted', { sessionId });
  }

  // Magic link token management
  static async storeMagicLinkToken(token: string, riderId: string): Promise<void> {
    const key = this.getKey('magic_link', token);
    await this.client.setEx(key, 900, riderId); // 15 minutes TTL
    logger.debug('Magic link token stored', { riderId });
  }

  static async verifyMagicLinkToken(token: string): Promise<boolean> {
    const key = this.getKey('magic_link', token);
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  static async invalidateMagicLinkToken(token: string): Promise<void> {
    const key = this.getKey('magic_link', token);
    await this.client.del(key);
    logger.debug('Magic link token invalidated');
  }

  // Rider session management
  static async setRiderSession(riderId: string, deviceId: string, sessionToken: string): Promise<void> {
    const key = this.getKey('rider_session', riderId, deviceId);
    await this.client.setEx(key, 1800, sessionToken); // 30 minutes TTL
    logger.debug('Rider session stored', { riderId, deviceId });
  }

  static async getRiderSession(riderId: string, deviceId: string): Promise<string | null> {
    const key = this.getKey('rider_session', riderId, deviceId);
    return await this.client.get(key);
  }

  static async deleteRiderSession(riderId: string, deviceId: string): Promise<void> {
    const key = this.getKey('rider_session', riderId, deviceId);
    await this.client.del(key);
    logger.debug('Rider session deleted', { riderId, deviceId });
  }

  // Unlock token JTI management (critical for security)
  static async storeUnlockTokenJti(jti: string, ttl: number): Promise<void> {
    const key = this.getKey('unlock_jti', jti);
    await this.client.setEx(key, ttl, '1');
    logger.debug('Unlock token JTI stored', { jti, ttl });
  }

  static async verifyUnlockTokenJti(jti: string): Promise<boolean> {
    const key = this.getKey('unlock_jti', jti);
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  static async consumeUnlockTokenJti(jti: string): Promise<void> {
    const key = this.getKey('unlock_jti', jti);
    await this.client.del(key);
    logger.debug('Unlock token JTI consumed', { jti });
  }

  // Rate limiting
  static async incrementRateLimit(key: string, windowMs: number): Promise<number> {
    const rateLimitKey = this.getKey('rate_limit', key);
    const current = await this.client.incr(rateLimitKey);
    
    if (current === 1) {
      await this.client.expire(rateLimitKey, Math.ceil(windowMs / 1000));
    }
    
    return current;
  }

  static async getRateLimit(key: string): Promise<number> {
    const rateLimitKey = this.getKey('rate_limit', key);
    const current = await this.client.get(rateLimitKey);
    return current ? parseInt(current, 10) : 0;
  }

  // Slot reservation management
  static async reserveSlot(slotId: string, orderId: string, ttl: number): Promise<boolean> {
    const key = this.getKey('slot_reservation', slotId);
    const result = await this.client.setNX(key, orderId);
    
    if (result) {
      await this.client.expire(key, ttl);
      logger.debug('Slot reserved', { slotId, orderId, ttl });
      return true;
    }
    
    return false;
  }

  static async getSlotReservation(slotId: string): Promise<string | null> {
    const key = this.getKey('slot_reservation', slotId);
    return await this.client.get(key);
  }

  static async releaseSlot(slotId: string): Promise<void> {
    const key = this.getKey('slot_reservation', slotId);
    await this.client.del(key);
    logger.debug('Slot released', { slotId });
  }

  // Device status tracking
  static async setDeviceStatus(deviceId: string, status: any, ttl: number = 300): Promise<void> {
    const key = this.getKey('device_status', deviceId);
    await this.client.setEx(key, ttl, JSON.stringify(status));
  }

  static async getDeviceStatus(deviceId: string): Promise<any | null> {
    const key = this.getKey('device_status', deviceId);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Caching for frequently accessed data
  static async setCache(key: string, value: any, ttl: number = 3600): Promise<void> {
    const cacheKey = this.getKey('cache', key);
    await this.client.setEx(cacheKey, ttl, JSON.stringify(value));
  }

  static async getCache(key: string): Promise<any | null> {
    const cacheKey = this.getKey('cache', key);
    const data = await this.client.get(cacheKey);
    return data ? JSON.parse(data) : null;
  }

  static async deleteCache(key: string): Promise<void> {
    const cacheKey = this.getKey('cache', key);
    await this.client.del(cacheKey);
  }

  // Pub/Sub for real-time events
  static async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
    logger.debug('Message published', { channel, message });
  }

  static async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(channel, (message) => {
      try {
        const parsed = JSON.parse(message);
        callback(parsed);
      } catch (error) {
        logger.error('Error parsing pub/sub message', { error, message });
      }
    });
    
    logger.debug('Subscribed to channel', { channel });
  }

  // Utility methods
  private static getKey(...parts: string[]): string {
    return `${config.redis.keyPrefix}${parts.join(':')}`;
  }

  static async flushAll(): Promise<void> {
    if (config.env === 'development' || config.env === 'test') {
      await this.client.flushAll();
      logger.warn('Redis database flushed (development/test only)');
    } else {
      throw new Error('Cannot flush Redis in production environment');
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return false;
    }
  }

  // Get Redis info for monitoring
  static async getInfo(): Promise<any> {
    const info = await this.client.info();
    return info;
  }

  static getConnectionStatus(): boolean {
    return this.isConnected;
  }
}