import { NextFunction, Request, Response } from 'express';
import Address from '@src/models/addressModel';
import catchAsync from '@src/utils/catchAsync';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';
import { IRequestWithUser } from './authController';
import AppError from '@src/utils/appError';
import { ADDRESS_AUTH_ERR } from '@src/constants/messages';
import { Role, StatusCode } from '@src/types/customTypes';

// Used for GET One, PATCH & DELETE APIs - Only allow user to delete/update their respective addresses
export const authenticateAddressAccess = catchAsync(
  async (req: IRequestWithUser, _: Response, next: NextFunction) => {
    const address = await Address.findById(req.params.id);
    if (
      req.user?.role === Role.CUSTOMER &&
      String(address?.user?._id) !== String(req.user?._id)
    ) {
      return next(new AppError(ADDRESS_AUTH_ERR, StatusCode.BAD_REQUEST));
    }
    return next();
  }
);

export const createAddress = createOne(Address);
export const updateAddress = updateOne(Address);
export const deleteAddress = deleteOne(Address);
export const getOneAddress = getOne(Address);

export const getAllAddress = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.query.user) {
      req.query.user = {
        $in: (req.query.user as string).split(','),
      };
    }
    await getAll(Address)(req, res, next);
  }
);
