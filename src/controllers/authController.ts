/* eslint-disable consistent-return */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import otpGenerator from 'otp-generator';
import { Express, NextFunction, Request, Response } from 'express';
import User, { IUser } from '@src/models/userModel';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
import { PRODUCTION } from '@src/constants/static';
import sendEmail from '@src/utils/sendEmail';
import AppError from '@src/utils/appError';
import {
  CURRENT_PASSWORD_INCORRECT,
  EMAIL_FAILED,
  INVALID_CREDENTIALS,
  INVALID_OTP,
  INVALID_TOKEN,
  LOGIN_AGAIN,
  NO_USER,
  OTP_EXPIRED,
  OTP_SENT,
  REGISTER_ERROR,
  TOKEN_SENT,
  UNAUTHORISED,
  UNAUTHORISED_ROLE,
} from '@src/constants/messages';

interface ICookieOptions {
  expires: Date;
  httpOnly: boolean;
  secure?: boolean;
}

interface ICustomFile extends Express.Multer.File {
  key: string;
  location: string;
}

interface MulterRequest extends Request {
  file: ICustomFile;
}

export interface IRequestWithUser extends Request {
  user?: IUser;
}

const generateToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SCERET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createAndSendToken = (
  user: IUser,
  statusCode: StatusCode,
  res: Response
) => {
  const token = generateToken(user._id!);
  const cookieOptions: ICookieOptions = {
    expires: new Date(
      Date.now() + +process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true, // if true => restrict anyone to change or manipulate cookie manually. It will be stored in browser, sent automatically on each request.
  };

  if (process.env.NODE_ENV === PRODUCTION) cookieOptions.secure = true; // allows to access only via https
  res.cookie('jwt', token, cookieOptions);
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

const verifyJwtToken = (token: string, secret: string) => {
  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    return new AppError(INVALID_TOKEN, StatusCode.UNAUTHORISED);
  }
};

// middlewares
export const protect = catchAsync(
  async (
    req: IRequestWithUser,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    let token = '';
    const { authorization } = req.headers;
    // 1. get token and check if it exist
    if (authorization && authorization.startsWith('Bearer')) {
      const [, authToken] = authorization.split(' ');
      token = authToken;
    }
    if (!token) {
      return next(new AppError(UNAUTHORISED, 401));
    }

    // 2. token verification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded: any = verifyJwtToken(token, process.env.JWT_SCERET);

    // 3. check if user still exist
    const currentUser = await User.findOne({ _id: decoded.id });
    if (!currentUser) {
      return next(new AppError(NO_USER, StatusCode.UNAUTHORISED));
    }

    // 4. check if user changed password after the token was issued
    if (currentUser.compareTimestamps(decoded.iat)) {
      return next(new AppError(LOGIN_AGAIN, StatusCode.UNAUTHORISED));
    }
    req.user = currentUser;
    return next();
  }
);

export const roleRistriction =
  (...roles: string[]) =>
  (req: IRequestWithUser, res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user!.role)) {
      return next(new AppError(UNAUTHORISED_ROLE, StatusCode.UNAUTHORISED));
    }
    next();
  };

const sendWelcomeEmail = async (newUser: IUser) => {
  // TODO: change email later
  await sendEmail({
    email: newUser.email,
    subject: 'Congrats! Welcome to Pinchbakehouse',
    message: 'So glad to see you here.',
  });
};
export const signup = catchAsync(
  async (req: MulterRequest, res: Response, next: NextFunction) => {
    if (!req.body || !Object.keys(req.body).length) {
      return next(new AppError(REGISTER_ERROR, StatusCode.BAD_REQUEST));
    }
    if (req.file) {
      req.body.photo = req.file;
    }
    const newUser = await User.create(req.body);
    if (!newUser) {
      return next(new AppError(REGISTER_ERROR, StatusCode.BAD_REQUEST));
    }
    createAndSendToken(newUser, StatusCode.CREATE, res);
    sendWelcomeEmail(newUser);
  }
);

export const signin = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    // 1. Check if email and password exists in body
    if (!email || !password) {
      return next(new AppError(INVALID_CREDENTIALS, StatusCode.BAD_REQUEST));
    }
    const user = await User.findOne({ email }).select('+password');

    // 2. Check if email and password is valid
    if (!user || !(await user.comparePassword(password, user.password))) {
      return next(new AppError(INVALID_CREDENTIALS, StatusCode.UNAUTHORISED));
    }

    return createAndSendToken(user, StatusCode.SUCCESS, res);
  }
);

export const forgotPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return next(new AppError(NO_USER, StatusCode.NOT_FOUND));
    }
    const resetToken = user.generateResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${req.protocol}://${req.get(
      'host'
    )}/reset-password/${resetToken}`;

    // TODO: change email later
    const message = `Forgot your password ? Don't worry, you can reset it here - ${resetUrl}. \nIf you remember the password then ignore the email.`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Reset password - valid for 10 minutes',
        message,
      });
      res.status(200).json({
        status: 'success',
        message: TOKEN_SENT,
      });
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordTokenExpiresIn = undefined;
      await user.save({ validateBeforeSave: false });
      return next(new AppError(EMAIL_FAILED, StatusCode.INTERNAL_SERVER_ERROR));
    }
  }
);

export const resetPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { password, confirmPassword } = req.body;
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');
    // 1. get user based on token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordTokenExpiresIn: {
        $gt: Date.now(),
      },
    });

    if (!user) {
      return next(new AppError(INVALID_TOKEN, StatusCode.BAD_REQUEST));
    }

    // 2. if token has not expired and there is user , set the new password
    user.password = password;
    user.confirmPassword = confirmPassword;
    user.resetPasswordTokenExpiresIn = undefined;
    user.resetPasswordToken = undefined;

    await user.save();
    createAndSendToken(user, 200, res);
  }
);

export const changePassword = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    // 1. get user from collection
    const user = await User.findById(req.user!._id).select('+password');
    // 2. check if entered password is correct
    if (
      !user ||
      !(await user.comparePassword(currentPassword, user.password))
    ) {
      return next(
        new AppError(CURRENT_PASSWORD_INCORRECT, StatusCode.BAD_REQUEST)
      );
    }
    // 3. update password
    user.password = newPassword;
    user.confirmPassword = confirmPassword;
    await user.save();

    // 4. send back token
    createAndSendToken(user, 200, res);
  }
);

export const sendOtp = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: true,
    specialChars: false,
  });
  const otpTimestamp = new Date();
  await User.findOneAndUpdate(
    { email },
    { otp, otpTimestamp },
    { upsert: true }
  );
  await sendEmail({
    email,
    subject: 'Your OTP for Pinchbakehouse',
    message: `OTP valid for 10 minutes - ${otp}`,
  });
  res.status(StatusCode.SUCCESS).json({
    status: 'success',
    message: OTP_SENT,
  });
});

export const verifyOtp = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { otp, email } = req.body;
    const user = await User.findOne({ email, otp });
    if (user) {
      // Check if OTP is still valid (within 10 minutes)
      const currentTime = new Date();
      const otpTimestamp = user?.otpTimestamp;
      const timeDifference = currentTime.getTime() - otpTimestamp!.getTime();
      const tenMinutesInMillis = 10 * 60 * 1000; // 10 minutes in milliseconds

      if (timeDifference <= tenMinutesInMillis) {
        // Clear the OTP after successful verification
        const currentUser = await User.findOneAndUpdate(
          { email },
          { $unset: { otp: 1, otpTimestamp: 1 } },
          { new: true }
        );
        return createAndSendToken(currentUser!, StatusCode.SUCCESS, res);
      }
      return next(new AppError(OTP_EXPIRED, StatusCode.BAD_REQUEST));
    }
    return next(new AppError(INVALID_OTP, StatusCode.BAD_REQUEST));
  }
);
