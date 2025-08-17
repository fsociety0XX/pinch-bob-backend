import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '@src/models/userModel';
import TokenService from '@src/services/tokenService';
import AppError from '@src/utils/appError';
import catchAsync from '@src/utils/catchAsync';

// Extend Request interface to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
  }
}

interface DecodedToken {
  id: string;
  iat: number;
  exp: number;
}

export const protect = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1) Getting token and check if it's there
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer')) {
      const [, authToken] = req.headers.authorization.split(' ');
      token = authToken;
    } else if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 2) Verification token
    let decoded: DecodedToken;
    try {
      decoded = jwt.verify(token, process.env.JWT_SCERET!) as DecodedToken;
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      // Token is invalid or expired, try to refresh if refresh token exists
      if (req.cookies.refreshToken && error.name === 'TokenExpiredError') {
        const refreshResult = await TokenService.refreshAccessToken(
          req.cookies.refreshToken,
          TokenService.extractDeviceInfo(req)
        );

        if (refreshResult) {
          // Set new tokens in cookies
          TokenService.setTokenCookies(res, refreshResult);

          // Verify the new access token
          try {
            const verifiedToken = TokenService.verifyAccessToken(
              refreshResult.accessToken
            );
            if (!verifiedToken) {
              throw new Error('Token verification failed');
            }
            decoded = verifiedToken;
          } catch {
            return next(
              new AppError('Invalid token. Please log in again.', 401)
            );
          }
        } else {
          return next(
            new AppError('Your session has expired. Please log in again.', 401)
          );
        }
      } else {
        return next(new AppError('Invalid token. Please log in again.', 401));
      }
    }

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError(
          'The user belonging to this token does no longer exist.',
          401
        )
      );
    }

    // 4) Check if user changed password after the token was issued
    // Note: This assumes changedPasswordAfter method exists on user model
    // If not implemented, you can skip this check or implement it in the user model

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
  }
);

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 400)
      );
    }

    next();
  };
};

export const optionalAuth = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // Try to get token but don't fail if it's not there
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer')) {
      const [, authToken] = req.headers.authorization.split(' ');
      token = authToken;
    } else if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        // Verify token
        const decoded = TokenService.verifyAccessToken(token);

        if (decoded) {
          // Check if user still exists
          const currentUser = await User.findById(decoded.id);
          if (currentUser) {
            req.user = currentUser;
          }
        }
      } catch (err) {
        // Silently fail for optional auth
        console.log('Optional auth failed:', err);
      }
    }

    next();
  }
);

export const refreshToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { refreshToken: token } = req.body;

    if (!token && !req.cookies.refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    const refreshTokenValue = token || req.cookies.refreshToken;
    const deviceInfo = TokenService.extractDeviceInfo(req);

    const result = await TokenService.refreshAccessToken(
      refreshTokenValue,
      deviceInfo
    );

    if (!result) {
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    // Set new tokens in cookies
    TokenService.setTokenCookies(res, result);

    res.status(200).json({
      status: 'success',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  }
);

export const logout = catchAsync(async (req: Request, res: Response) => {
  // Revoke refresh token if provided
  if (req.cookies.refreshToken) {
    await TokenService.revokeRefreshToken(req.cookies.refreshToken);
  }

  // Clear cookies
  TokenService.clearTokenCookies(res);

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

export const logoutAll = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    // Revoke all user tokens
    await TokenService.revokeAllUserTokens(req.user._id.toString());

    // Clear cookies
    TokenService.clearTokenCookies(res);

    res.status(200).json({
      status: 'success',
      message: 'Logged out from all devices successfully',
    });
  }
);
