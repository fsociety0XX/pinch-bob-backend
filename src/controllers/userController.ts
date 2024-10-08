import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '@src/models/userModel';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
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

export const addToWishlist = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || '';
  const { productId } = req.query;

  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $push: { wishlist: productId } }
  );

  res.status(StatusCode.SUCCESS).json({
    status: 'success',
    message: 'The product has been added to your wishlist.',
  });

  return false;
});

export const addToCart = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || '';
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
  } = req.query;
  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    {
      $push: {
        cart: {
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
        },
      },
    }
  );

  res.status(StatusCode.SUCCESS).json({
    status: 'success',
    message: 'The product has been added to your cart.',
  });

  return false;
});
