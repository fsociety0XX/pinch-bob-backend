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

const productFieldsToRemove = {
  'product.product.brand': 0,
  'product.product.ratingsAvg': 0,
  'product.product.totalRatings': 0,
  'product.product.type': 0,
  'product.product.details': 0,
  'product.product.preparationDays': 0,
  'product.product.available': 0,
  'product.product.recommended': 0,
  'product.product.category': 0,
  'product.product.superCategory': 0,
  'product.product.fbt': 0,
  'product.product.active': 0,
  'product.product.createdAt': 0,
  'product.product.updatedAt': 0,
  'product.product.__v': 0,
  'product.product.sold': 0,
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
        $unwind: '$product', // Deconstruct the product array
      },
      {
        $lookup: {
          from: 'products',
          localField: 'product.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $lookup: {
          from: 'deliverymethods',
          localField: 'delivery.method',
          foreignField: '_id',
          as: 'delivery.method',
        },
      },
      {
        $unwind: '$delivery.method',
      },
      {
        $unwind: '$productDetails',
      },
      {
        $addFields: {
          'product.product': '$productDetails',
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
        $group: {
          // Group back to original document structure
          _id: '$_id',
          brand: { $first: '$brand' },
          orderNumber: { $first: '$orderNumber' },
          deliveryType: { $first: '$deliveryType' },
          product: { $push: '$product' },
          user: { $first: '$user' },
          delivery: { $first: '$delivery' },
          pricingSummary: {
            $first: '$pricingSummary',
          },
          recipInfo: { $first: '$recipInfo' },
          paid: { $first: '$paid' },
          active: { $first: '$active' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          __v: { $first: '$__v' },
          woodeliveryTaskId: {
            $first: '$woodeliveryTaskId',
          },
          status: { $first: '$status' },
        },
      },
      {
        $sort: { createdAt: -1 }, // Sort documents by createdAt in descending order
      },
      {
        $project: { ...userFieldsToRemove, ...productFieldsToRemove },
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
        $lookup: {
          from: 'deliverymethods',
          localField: 'method',
          foreignField: '_id',
          as: 'method',
        },
      },
      {
        $lookup: {
          from: 'addresses',
          localField: 'address',
          foreignField: '_id',
          as: 'address',
        },
      },
      {
        $unwind: '$method',
      },
      {
        $unwind: '$address',
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
        $unwind: '$order.product',
      },
      {
        $lookup: {
          from: 'products',
          localField: 'order.product.product',
          foreignField: '_id',
          as: 'order.productDetails',
        },
      },
      {
        $unwind: '$order.productDetails',
      },
      {
        $addFields: {
          'order.product.product': '$order.productDetails',
        },
      },
      {
        $group: {
          // Group back to original document structure
          _id: '$_id',
          brand: { $first: '$brand' },
          order: { $first: '$order' },
          product: {
            $push: '$order.product',
          },
          deliveryDate: { $first: '$deliveryDate' },
          method: { $first: '$method' },
          collectionTime: { $first: '$collectionTime' },
          address: { $first: '$address' },
          recipientName: { $first: '$recipientName' },
          recipientPhone: { $first: '$recipientPhone' },
          recipientEmail: { $first: '$recipientEmail' },
          woodeliveryTaskId: { $first: '$woodeliveryTaskId' },
          active: { $first: '$active' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          __v: { $first: '$__v' },
          status: { $first: '$status' },
          driverDetails: { $first: '$driverDetails' },
          user: { $first: '$user' },
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
        $sort: { createdAt: -1 }, // Sort documents by createdAt in descending order
      },
      {
        $project: {
          'order.product': 0,
          'order.productDetails': 0,
          ...userFieldsToRemove,
          ...orderFieldsToRemove,
          ...productFieldsToRemove,
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
