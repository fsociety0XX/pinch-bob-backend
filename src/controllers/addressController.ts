// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Added only for migration controller function and need to remove it later
import { NextFunction, Request, Response } from 'express';
import Address, { IAddress } from '@src/models/addressModel';
import catchAsync from '@src/utils/catchAsync';
import {
  createOne,
  getAll,
  getOne,
  softDeleteOne,
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
export const deleteAddress = softDeleteOne(Address);
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

export const migrateAddress = catchAsync(
  async (req: Request, res: Response) => {
    const { addresses } = req.body || [];
    const failedIds: number[] = [];
    const bulkOps = await Promise.all(
      addresses.map(async (address: IAddress) => ({
        insertOne: { document: address },
      }))
    );

    const result = await Address.bulkWrite(bulkOps, { ordered: false });

    if (result?.writeErrors && result.writeErrors?.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.writeErrors.forEach((err: any) => {
        failedIds.push(addresses[err.index]?.sqlId);
      });
    }

    res.status(200).json({
      message: 'Migration completed',
      failedIds,
    });
  }
);
