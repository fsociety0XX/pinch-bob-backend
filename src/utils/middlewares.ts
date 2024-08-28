import { NextFunction, Request, Response } from 'express';
import { IRequestWithUser } from '@src/controllers/authController';
import { CANCELLED, Role } from '@src/types/customTypes';

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

// This middleware protects sign up route. Any user created from this route
// can only have role as 'customer'
export const appendDefaultUserRoleInReq = (
  req: Request,
  _: Response,
  next: NextFunction
): void => {
  req.body = { ...req.body, role: Role.CUSTOMER };
  return next();
};

// This middleware is used to send list of deliveries except cancelled ones
export const appendCancelledStatusInReqQuery = (
  req: Request,
  _: Response,
  next: NextFunction
): void => {
  // Check if there is an existing status filter in req.query
  let statusFilter;
  if (req.query.status?.length) {
    statusFilter = {
      status: req.query.status,
    };
  }

  // Merge the existing status filter with the new condition to exclude 'canceled'
  statusFilter = { ...statusFilter, $ne: CANCELLED };

  // Update req.query.status with the modified filter
  req.query.status = JSON.stringify(statusFilter);

  return next();
};
