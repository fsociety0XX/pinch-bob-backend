/* eslint-disable import/prefer-default-export */
import { Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
// import Order from '@src/models/orderModel';
import { IRequestWithUser } from './authController';

export const placeOrder = catchAsync(
  async (req: IRequestWithUser, res: Response) => {
    req.body.user = req.user?._id;
    // const doc = await Order.create(req.body);
    res.send(200);
  }
);
