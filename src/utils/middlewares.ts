import { NextFunction, Response } from 'express';
import { IRequestWithUser } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';

// Usefull for filtering out data based on current logged in user
export const appendUserIdInReqQuery = (
  req: IRequestWithUser,
  _: Response,
  next: NextFunction
): void => {
  if (req.user?.role === Role.CUSTOMER)
    req.query = { ...req.query, user: String(req.user?._id) };
  return next();
};

export const appendUserIdInReqBody = (
  req: IRequestWithUser,
  _: Response,
  next: NextFunction
): void => {
  req.body = { ...req.body, user: req.user?._id };
  return next();
};
