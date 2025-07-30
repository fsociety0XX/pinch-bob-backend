/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
import Order from '@src/models/orderModel';
import Delivery from '@src/models/deliveryModel';

// Modes
type Mode = 'order' | 'delivery';

// Case-insensitive regex
const regex = (search: string) => ({ $regex: new RegExp(search, 'i') });

export const createSearchQuery = (
  mode: Mode,
  search: string,
  brand: string,
  skip: number,
  limit: number
): { pipeline: any[]; model: any } => {
  const pipeline: any[] = [];
  const isTextSearch = !!search.trim();
  const isLikelyEmail = search.includes('@');
  const isLikelyPhone = /^\+?\d+$/.test(search);

  // Initial brand match
  pipeline.push({ $match: { brand } });

  // Smart conditions
  const matchConditions: any[] = [];

  if (isLikelyEmail) {
    matchConditions.push({ 'customer.email': search });
  }

  if (isLikelyPhone) {
    matchConditions.push({ 'customer.phone': search });
    matchConditions.push({ recipientPhone: search });
    matchConditions.push({ 'recipInfo.contact': search });
  }

  matchConditions.push({ orderNumber: search });

  if (!isLikelyEmail && !isLikelyPhone && isTextSearch) {
    matchConditions.push(
      { 'customer.firstName': regex(search) },
      { 'customer.lastName': regex(search) },
      { 'customer.email': regex(search) },
      { 'customer.phone': regex(search) },
      { orderNumber: regex(search) },
      { recipientName: regex(search) },
      { recipientPhone: regex(search) },
      { woodeliveryTaskId: regex(search) },
      { 'recipInfo.name': regex(search) }
    );
  }

  if (matchConditions.length > 0) {
    pipeline.push({ $match: { $or: matchConditions } });
  }

  if (mode === 'delivery') {
    pipeline.push(
      {
        $lookup: {
          from: 'deliverymethods',
          localField: 'method',
          foreignField: '_id',
          as: 'method',
        },
      },
      { $unwind: { path: '$method', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'addresses',
          localField: 'address',
          foreignField: '_id',
          as: 'address',
        },
      },
      { $unwind: { path: '$address', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          brand: 1,
          deliveryDate: 1,
          method: {
            _id: '$method._id',
            name: '$method.name',
            id: '$method._id',
          },
          collectionTime: 1,
          user: {
            firstName: '$customer.firstName',
            lastName: '$customer.lastName',
            email: '$customer.email',
            phone: '$customer.phone',
          },
          address: {
            _id: '$address._id',
            firstName: '$address.firstName',
            lastName: '$address.lastName',
            city: '$address.city',
            country: '$address.country',
            company: '$address.company',
            address1: '$address.address1',
            address2: '$address.address2',
            postalCode: '$address.postalCode',
            phone: '$address.phone',
            unitNumber: '$address.unitNumber',
            id: '$address._id',
          },
          recipientName: 1,
          recipientPhone: 1,
          recipientEmail: 1,
          orderNumber: 1,
          woodeliveryTaskId: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          driverDetails: 1,
          customiseCakeForm: 1,
          customiseCakeFormDetails: {
            id: '$customiseCakeOrder',
          },
          id: '$_id',
        },
      }
    );
  } else {
    pipeline.push(
      {
        $lookup: {
          from: 'deliverymethods',
          localField: 'delivery.method',
          foreignField: '_id',
          as: 'deliveryMethod',
        },
      },
      {
        $unwind: { path: '$deliveryMethod', preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          recipInfo: 1,
          _id: 1,
          orderNumber: 1,
          brand: 1,
          corporate: 1,
          createdAt: 1,
          forKitchenUse: 1,
          woodeliveryTaskId: 1,
          status: 1,
          customiseCakeForm: 1,
          customiseCakeFormDetails: {
            id: '$customiseCakeFormDetails',
          },
          deliveryType: 1,
          paid: 1,
          preparationStatus: 1,
          updatedAt: 1,
          delivery: {
            date: '$delivery.date',
            collectionTime: '$delivery.collectionTime',
            method: {
              _id: '$deliveryMethod._id',
              name: '$deliveryMethod.name',
              updatedAt: '$deliveryMethod.updatedAt',
              id: '$deliveryMethod._id',
            },
            address: '$delivery.address',
            _id: '$delivery._id',
          },
          pricingSummary: 1,
          user: {
            firstName: '$customer.firstName',
            lastName: '$customer.lastName',
            email: '$customer.email',
            phone: '$customer.phone',
          },
          id: '$_id',
        },
      }
    );
  }

  // Pagination
  pipeline.push({
    $facet: {
      data: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }],
      total: [{ $count: 'count' }],
    },
  });

  return { pipeline, model: mode === 'delivery' ? Delivery : Order };
};

export const globalTableSearch = catchAsync(
  async (req: Request, res: Response) => {
    const searchTerm = String(req.query.search || '').trim();
    const mode = String(req.query.mode || '') as Mode;
    const brand = String(req.query.brand || '');

    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const limit = Math.max(parseInt(String(req.query.limit || '20'), 10), 1);
    const skip = (page - 1) * limit;

    const { pipeline, model } = createSearchQuery(
      mode,
      searchTerm,
      brand,
      skip,
      limit
    );
    const [result] = await model.aggregate(pipeline).allowDiskUse(true);

    const docs = result?.data || [];
    const totalCount = result?.total?.[0]?.count || 0;

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: { data: docs },
      meta: { totalCount, page, limit },
    });
  }
);
