import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response } from 'express';
import RefreshToken from '@src/models/refreshTokenModel';
import { IUser } from '@src/models/userModel';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface DeviceInfo {
  userAgent?: string;
  ip?: string;
  deviceId?: string;
}

interface DecodedToken {
  id: string;
  iat: number;
  exp: number;
}

export default class TokenService {
  // Generate Access Token (Short-lived)
  static generateAccessToken(userId: string): string {
    const secret = process.env.JWT_SCERET as string;
    const expiresIn = process.env.JWT_EXPIRES_IN as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (jwt.sign as any)({ id: userId }, secret, { expiresIn });
  }

  // Generate Refresh Token (Long-lived)
  static generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  // Create Token Pair
  static async createTokenPair(
    user: IUser,
    deviceInfo?: DeviceInfo
  ): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(user._id.toString());
    const refreshToken = this.generateRefreshToken();

    // Calculate expiry
    const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    const expiresAt = new Date();

    if (expiresIn.includes('d')) {
      const days = parseInt(expiresIn.replace('d', ''), 10);
      expiresAt.setDate(expiresAt.getDate() + days);
    } else if (expiresIn.includes('h')) {
      const hours = parseInt(expiresIn.replace('h', ''), 10);
      expiresAt.setHours(expiresAt.getHours() + hours);
    }

    // Store refresh token in database
    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt,
      deviceInfo,
    });

    return { accessToken, refreshToken };
  }

  // Refresh Access Token
  static async refreshAccessToken(
    refreshToken: string,
    deviceInfo?: DeviceInfo
  ): Promise<TokenPair | null> {
    try {
      // Find valid refresh token
      const tokenDoc = await RefreshToken.findOne({
        token: refreshToken,
        isRevoked: false,
        expiresAt: { $gt: new Date() },
      }).populate('user');

      if (!tokenDoc || !tokenDoc.user) {
        return null;
      }

      // Generate new token pair
      const newTokenPair = await this.createTokenPair(
        tokenDoc.user as unknown as IUser,
        deviceInfo
      );

      // Revoke old refresh token
      tokenDoc.isRevoked = true;
      await tokenDoc.save();

      return newTokenPair;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  // Revoke Refresh Token
  static async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    try {
      const result = await RefreshToken.updateOne(
        { token: refreshToken },
        { isRevoked: true }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error revoking token:', error);
      return false;
    }
  }

  // Revoke All User Tokens
  static async revokeAllUserTokens(userId: string): Promise<boolean> {
    try {
      await RefreshToken.updateMany(
        { user: userId, isRevoked: false },
        { isRevoked: true }
      );
      return true;
    } catch (error) {
      console.error('Error revoking all user tokens:', error);
      return false;
    }
  }

  // Clean up expired tokens
  static async cleanupExpiredTokens(): Promise<void> {
    try {
      await RefreshToken.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          {
            isRevoked: true,
            createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          },
        ],
      });
    } catch (error) {
      console.error('Error cleaning up tokens:', error);
    }
  }

  // Extract device info from request
  static extractDeviceInfo(req: Request): DeviceInfo {
    return {
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      deviceId: req.get('X-Device-ID'), // Custom header for device identification
    };
  }

  // Verify Access Token
  static verifyAccessToken(token: string): DecodedToken | null {
    try {
      return jwt.verify(token, process.env.JWT_SCERET!) as DecodedToken;
    } catch (error) {
      return null;
    }
  }

  // Set secure cookies
  static setTokenCookies(res: Response, tokens: TokenPair): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token cookie (short-lived)
    res.cookie('accessToken', tokens.accessToken, {
      expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
    });

    // Refresh token cookie (long-lived)
    const refreshExpiry = process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN || '7';
    res.cookie('refreshToken', tokens.refreshToken, {
      expires: new Date(
        Date.now() + parseInt(refreshExpiry, 10) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
    });
  }

  // Clear token cookies
  static clearTokenCookies(res: Response): void {
    res.cookie('accessToken', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.cookie('refreshToken', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });
  }
}
