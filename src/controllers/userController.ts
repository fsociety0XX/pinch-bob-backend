/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Added only for migration controller function and need to remove it later
import bcrypt from 'bcrypt';
import { Response, NextFunction } from 'express';
import AppError from '@src/utils/appError';
import User, { IUser } from '@src/models/userModel';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
import { NO_DATA_FOUND } from '@src/constants/messages';
import { IRequestWithUser } from './authController';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createUser = createOne(User);
export const updateUser = updateOne(User);
export const deleteUser = deleteOne(User);
export const getOneUser = getOne(User);
export const getAllUser = getAll(User);

export const addToWishlist = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    const doc = await User.findByIdAndUpdate(
      req.user?._id,
      { $push: { wishlist: req.params.id } },
      { new: true }
    );
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
    return false;
  }
);

export const addToCart = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    const {
      product,
      price,
      quantity,
      size,
      pieces,
      flavour,
      colour,
      card,
      refImage,
      msg,
      specialInstructions,
      fondantName,
      fondantNumber,
      moneyPulling,
      address,
    } = req.body;

    const cart = {
      product,
      price,
      quantity,
      size,
      pieces,
      flavour,
      colour,
      card,
      refImage,
      msg,
      specialInstructions,
      fondantName,
      fondantNumber,
      moneyPulling,
      address,
    };

    const doc = await User.findByIdAndUpdate(
      req.user?._id,
      { $push: { cart } },
      { new: true }
    );

    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });

    return false;
  }
);

export const migrateUsers = catchAsync(async (req: Request, res: Response) => {
  const { users } = req.body || [];
  const failedIds: number[] = [];
  const bulkOps = await Promise.all(
    users.map(async (user: IUser) => {
      user.password = await bcrypt.hash(user.password, 12);
      return { insertOne: { document: user } };
    })
  );

  const result = await User.bulkWrite(bulkOps, { ordered: false });

  if (result.writeErrors && result.writeErrors.length > 0) {
    result.writeErrors.forEach((err: any) => {
      failedIds.push(users[err.index]?.sqlId);
    });
  }

  res.status(200).json({
    message: 'Migration completed',
    failedIds,
  });
});
