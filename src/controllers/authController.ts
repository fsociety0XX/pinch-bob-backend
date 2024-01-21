import jwt from 'jsonwebtoken';
import { Express, Request, Response } from 'express';
import User, { IUser } from '@src/models/userModel';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
import { PRODUCTION } from '@src/constants/static';

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
    httpOnly: true, // restrict anyone to change or manipulate cookie manually. It will be stored in browser, sent automatically on each request.
  };

  if (process.env.NODE_ENV === PRODUCTION) cookieOptions.secure = true; // allows to access only via https
  res.cookie('jwt', token, cookieOptions);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userData: any = { ...user };
  delete userData.password;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

// TODO
// eslint-disable-next-line import/prefer-default-export
export const signup = catchAsync(async (req: MulterRequest, res: Response) => {
  if (req.file) {
    const { key, originalname, mimetype, size, location } = req.file;
    req.body.profile = {
      key,
      name: originalname,
      mimeType: mimetype,
      size,
      url: location,
    };
  }
  const newUser = await User.create(req.body);
  createAndSendToken(newUser, StatusCode.CREATE, res);
});
