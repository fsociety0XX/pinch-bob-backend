/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
import Order from '@src/models/orderModel';
import Delivery from '@src/models/deliveryModel';

const userFieldsToRemove = {
  'user.password': 0,
  'user.brand': 0,
  'user.role': 0,
  'user.wishlist': 0,
  'user.cart': 0,
  'user.active': 0,
  'user.createdAt': 0,
  'user.updatedAt': 0,
  'user.__v': 0,
};

const orderFieldsToRemove = {
  'order.brand': 0,
  'order.deliveryType': 0,
  'order.pricingSummary': 0,
  'order.user': 0,
  'order.recipInfo': 0,
  'order.paid': 0,
  'order.active': 0,
  'order.createdAt': 0,
  'order.updatedAt': 0,
  'order.__v': 0,
  'order.woodeliveryTaskId': 0,
};

export const createSearchQuery = (
  mode: string,
  search: string
): { pipeline: any; model: any } => {
  let pipeline;
  let model;
  const s = { $regex: new RegExp(search, 'i') };

  if (mode === 'order') {
    pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $addFields: {
          user: {
            $arrayElemAt: ['$user', 0],
          },
        },
      },
      {
        $match: {
          $or: [
            { orderNumber: s },
            { 'user.firstName': s },
            { 'user.lastName': s },
            { 'user.email': s },
            { 'user.phone': s },
            { 'recipInfo.name': s },
            { woodeliveryTaskId: s },
            {
              'recipInfo.contact': {
                $in: [search, parseInt(String(search), 10)],
              },
            },
          ],
        },
      },
      {
        $project: userFieldsToRemove,
      },
    ];

    model = Order;
  }
  if (mode === 'delivery') {
    pipeline = [
      {
        $lookup: {
          from: 'orders',
          localField: 'order',
          foreignField: '_id',
          as: 'order',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'order.user',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $addFields: {
          order: {
            $arrayElemAt: ['$order', 0],
          },
          user: {
            $arrayElemAt: ['$user', 0],
          },
        },
      },
      {
        $match: {
          $or: [
            { 'order.orderNumber': s },
            { 'user.firstName': s },
            { 'user.lastName': s },
            { 'user.email': s },
            { 'user.phone': s },
            { recipientName: s },
            { recipientPhone: s },
            { woodeliveryTaskId: s },
          ],
        },
      },
      {
        $project: {
          ...userFieldsToRemove,
          ...orderFieldsToRemove,
        },
      },
    ];
    model = Delivery;
  }

  return { pipeline, model };
};

export const globalTableSearch = catchAsync(
  async (req: Request, res: Response) => {
    const searchTerm = (req.query.search as string) || '';
    const mode = (req.query.mode as string) || '';
    const { pipeline, model } = createSearchQuery(mode, searchTerm);

    const docs = await model.aggregate(pipeline);
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: docs,
      },
      meta: {
        totalDataCount: docs?.length,
      },
    });
  }
);
