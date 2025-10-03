import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { config } from '../config';
import { logger, logSecurityEvent, logFailedAuth } from '../utils/logger';
import { RedisService } from './RedisService';
import { DatabaseService } from './DatabaseService';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: 'staff' | 'manager' | 'admin' | 'installer';
  passwordHash: string;
  totpSecret?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Rider {
  id: string;
  platformId: string; // Uber/Deliveroo/etc rider ID
  platform: 'uber_eats' | 'deliveroo' | 'just_eat' | 'independent';
  deviceId?: string;
  lastLoginAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface UnlockToken {
  jti: string;
  tenantId: string;
  siteId: string;
  shelfId: string;
  slotId: string;
  orderId: string;
  riderId: string;
  exp: number;
  nbf: number;
  iat: number;
}

export interface AccessToken {
  userId: string;
  tenantId: string;
  role: string;
  sessionId: string;
  exp: number;
  iat: number;
}

export class AuthService {
  private static jwtPrivateKey: string;
  private static jwtPublicKey: string;
  private static unlockTokenPrivateKey: string;
  private static unlockTokenPublicKey: string;

  static async initialize() {
    logger.info('Initializing AuthService...');
    
    // In production, these would be loaded from KMS/secure storage
    // For now, using configuration values
    this.jwtPrivateKey = config.jwt.secret;
    this.jwtPublicKey = config.jwt.secret; // In real deployment, use asymmetric keys
    this.unlockTokenPrivateKey = config.jwt.unlockTokenSecret;
    this.unlockTokenPublicKey = config.jwt.unlockTokenSecret;
    
    logger.info('AuthService initialized successfully');
  }

  // Staff authentication with TOTP MFA
  static async authenticateStaff(email: string, password: string, totpCode?: string): Promise<{ user: User; accessToken: string; refreshToken: string } | null> {
    try {
      // Find user in database
      const user = await this.findUserByEmail(email);
      if (!user || !user.isActive) {
        logFailedAuth({ email, reason: 'user_not_found', ip: 'unknown' });
        return null;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        logFailedAuth({ email, reason: 'invalid_password', ip: 'unknown' });
        return null;
      }

      // Verify TOTP if enabled
      if (user.totpSecret) {
        if (!totpCode) {
          throw new Error('TOTP code required');
        }
        
        const isValidTotp = speakeasy.totp.verify({
          secret: user.totpSecret,
          encoding: 'base32',
          token: totpCode,
          window: 2, // Allow ±60 seconds clock skew
        });

        if (!isValidTotp) {
          logFailedAuth({ email, reason: 'invalid_totp', ip: 'unknown' });
          return null;
        }
      }

      // Generate session
      const sessionId = crypto.randomUUID();
      const accessToken = await this.generateAccessToken(user, sessionId);
      const refreshToken = await this.generateRefreshToken(user.id, sessionId);

      // Store session in Redis
      await RedisService.setSession(sessionId, {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        loginAt: new Date(),
      });

      // Update last login
      await this.updateUserLastLogin(user.id);

      logSecurityEvent('staff_login_success', { userId: user.id, email });

      return { user, accessToken, refreshToken };
    } catch (error) {
      logger.error('Staff authentication error', { error, email });
      return null;
    }
  }

  // Rider magic link authentication
  static async generateRiderMagicLink(platformId: string, platform: string): Promise<string> {
    try {
      // Find or create rider
      let rider = await this.findRiderByPlatformId(platformId, platform);
      if (!rider) {
        rider = await this.createRider(platformId, platform);
      }

      // Generate magic link token
      const token = jwt.sign(
        {
          riderId: rider.id,
          platformId,
          platform,
          type: 'magic_link',
        },
        this.jwtPrivateKey,
        {
          expiresIn: '15m', // Magic links expire in 15 minutes
          algorithm: 'HS256',
        }
      );

      // Store token in Redis with short TTL
      await RedisService.storeMagicLinkToken(token, rider.id);

      const magicLink = `${config.frontendUrl}/rider/auth?token=${token}`;
      
      logSecurityEvent('magic_link_generated', { riderId: rider.id, platformId });
      
      return magicLink;
    } catch (error) {
      logger.error('Magic link generation error', { error, platformId, platform });
      throw error;
    }
  }

  // Verify magic link and create rider session
  static async verifyMagicLink(token: string, deviceId: string): Promise<{ rider: Rider; sessionToken: string } | null> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtPublicKey) as any;
      
      if (decoded.type !== 'magic_link') {
        throw new Error('Invalid token type');
      }

      // Check if token was used (stored in Redis)
      const isTokenValid = await RedisService.verifyMagicLinkToken(token);
      if (!isTokenValid) {
        logFailedAuth({ token: token.slice(0, 10), reason: 'token_already_used', ip: 'unknown' });
        return null;
      }

      // Get rider
      const rider = await this.findRiderById(decoded.riderId);
      if (!rider || !rider.isActive) {
        return null;
      }

      // Generate session token
      const sessionToken = jwt.sign(
        {
          riderId: rider.id,
          deviceId,
          type: 'rider_session',
        },
        this.jwtPrivateKey,
        {
          expiresIn: '30m', // Rider sessions last 30 minutes
          algorithm: 'HS256',
        }
      );

      // Store session
      await RedisService.setRiderSession(rider.id, deviceId, sessionToken);

      // Invalidate magic link token
      await RedisService.invalidateMagicLinkToken(token);

      // Update last login
      await this.updateRiderLastLogin(rider.id);

      logSecurityEvent('rider_login_success', { riderId: rider.id, deviceId });

      return { rider, sessionToken };
    } catch (error) {
      logger.error('Magic link verification error', { error, token: token.slice(0, 10) });
      return null;
    }
  }

  // Generate single-use unlock token (core security feature)
  static async generateUnlockToken(
    orderId: string,
    riderId: string,
    slotId: string,
    shelfId: string,
    siteId: string,
    tenantId: string
  ): Promise<string> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const jti = crypto.randomUUID(); // Unique token ID for replay prevention
      
      const tokenPayload: UnlockToken = {
        jti,
        tenantId,
        siteId,
        shelfId,
        slotId,
        orderId,
        riderId,
        iat: now,
        nbf: now,
        exp: now + config.jwt.unlockTokenTTL, // 60 seconds TTL
      };

      // Sign with ES256 algorithm for better security
      const token = jwt.sign(
        tokenPayload,
        this.unlockTokenPrivateKey,
        {
          algorithm: 'HS256', // In production, use ES256
          keyid: 'unlock-key-1', // Key rotation support
        }
      );

      // Store JTI in Redis for single-use enforcement
      await RedisService.storeUnlockTokenJti(jti, config.jwt.unlockTokenTTL + 10); // Small buffer

      logSecurityEvent('unlock_token_generated', {
        jti,
        slotId,
        orderId,
        riderId,
        ttl: config.jwt.unlockTokenTTL,
      });

      return token;
    } catch (error) {
      logger.error('Unlock token generation error', { error, orderId, riderId, slotId });
      throw error;
    }
  }

  // Verify unlock token (called by device)
  static async verifyUnlockToken(token: string, requestingShelfId: string): Promise<UnlockToken | null> {
    try {
      // Verify JWT signature and claims
      const decoded = jwt.verify(token, this.unlockTokenPublicKey, {
        algorithms: ['HS256'], // In production, use ['ES256']
        clockTolerance: config.security.clockSkewToleranceSeconds,
      }) as UnlockToken;

      // Verify audience (shelf must match)
      if (decoded.shelfId !== requestingShelfId) {
        logSecurityEvent('unlock_token_wrong_shelf', {
          jti: decoded.jti,
          expectedShelf: requestingShelfId,
          tokenShelf: decoded.shelfId,
        });
        return null;
      }

      // Check single-use (JTI not already consumed)
      const isJtiValid = await RedisService.verifyUnlockTokenJti(decoded.jti);
      if (!isJtiValid) {
        logSecurityEvent('unlock_token_replay_attempt', {
          jti: decoded.jti,
          shelfId: requestingShelfId,
        });
        return null;
      }

      // Consume the JTI (mark as used)
      await RedisService.consumeUnlockTokenJti(decoded.jti);

      logSecurityEvent('unlock_token_verified', {
        jti: decoded.jti,
        slotId: decoded.slotId,
        orderId: decoded.orderId,
        riderId: decoded.riderId,
      });

      return decoded;
    } catch (error) {
      logger.error('Unlock token verification error', { error, token: token.slice(0, 20) });
      logSecurityEvent('unlock_token_verification_failed', {
        error: (error as Error).message,
        shelfId: requestingShelfId,
      });
      return null;
    }
  }

  // Refresh access token
  static async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtPrivateKey) as any;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Verify session still exists
      const session = await RedisService.getSession(decoded.sessionId);
      if (!session) {
        return null;
      }

      const user = await this.findUserById(decoded.userId);
      if (!user || !user.isActive) {
        return null;
      }

      // Generate new access token
      const newAccessToken = await this.generateAccessToken(user, decoded.sessionId);
      
      return newAccessToken;
    } catch (error) {
      logger.error('Token refresh error', { error });
      return null;
    }
  }

  // Staff step-up authentication for sensitive operations
  static async verifyStepUpAuth(userId: string, totpCode: string): Promise<boolean> {
    try {
      const user = await this.findUserById(userId);
      if (!user || !user.totpSecret) {
        return false;
      }

      const isValid = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: 'base32',
        token: totpCode,
        window: 1, // Stricter window for step-up
      });

      if (isValid) {
        logSecurityEvent('step_up_auth_success', { userId });
      } else {
        logSecurityEvent('step_up_auth_failed', { userId });
      }

      return isValid;
    } catch (error) {
      logger.error('Step-up auth error', { error, userId });
      return false;
    }
  }

  // Private helper methods
  private static async generateAccessToken(user: User, sessionId: string): Promise<string> {
    const payload: AccessToken = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + config.jwt.accessTokenTTL,
    };

    return jwt.sign(payload, this.jwtPrivateKey, {
      algorithm: 'HS256',
    });
  }

  private static async generateRefreshToken(userId: string, sessionId: string): Promise<string> {
    return jwt.sign(
      {
        userId,
        sessionId,
        type: 'refresh',
      },
      this.jwtPrivateKey,
      {
        expiresIn: config.jwt.refreshTokenTTL,
        algorithm: 'HS256',
      }
    );
  }

  // Database interaction methods (these would connect to actual database)
  private static async findUserByEmail(email: string): Promise<User | null> {
    // Placeholder - implement with actual database query
    return null;
  }

  private static async findUserById(id: string): Promise<User | null> {
    // Placeholder - implement with actual database query
    return null;
  }

  private static async findRiderByPlatformId(platformId: string, platform: string): Promise<Rider | null> {
    // Placeholder - implement with actual database query
    return null;
  }

  private static async findRiderById(id: string): Promise<Rider | null> {
    // Placeholder - implement with actual database query
    return null;
  }

  private static async createRider(platformId: string, platform: string): Promise<Rider> {
    // Placeholder - implement with actual database query
    return {
      id: crypto.randomUUID(),
      platformId,
      platform: platform as any,
      isActive: true,
      createdAt: new Date(),
    };
  }

  private static async updateUserLastLogin(userId: string): Promise<void> {
    // Placeholder - implement with actual database query
  }

  private static async updateRiderLastLogin(riderId: string): Promise<void> {
    // Placeholder - implement with actual database query
  }
}