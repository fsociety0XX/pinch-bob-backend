import { Response, NextFunction } from 'express';
import AppError from '@src/utils/appError';
import User from '@src/models/userModel';
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
