/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
import Order from '@src/models/orderModel';
import Delivery from '@src/models/deliveryModel';

type Mode = 'order' | 'delivery';

interface LookupOpts {
  from: string;
  letLocal: string;
  as: string;
  project: Record<string, 0 | 1>;
}

/**
 * Returns a $lookup + safe $unwind for a single field
 */
const makeLookup = ({ from, letLocal, as, project }: LookupOpts) => [
  {
    $lookup: {
      from,
      let: { localId: `$${letLocal}` },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$localId'] } } },
        { $project: project },
      ],
      as,
    },
  },
  {
    $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true },
  },
];

export const createSearchQuery = (
  mode: Mode,
  search: string,
  brand: string
): { pipeline: any[]; model: any } => {
  // case-insensitive regex for matching
  const s = { $regex: new RegExp(search, 'i') };

  // start with brand filter
  const pipeline: any[] = [{ $match: { brand } }];

  if (mode === 'delivery') {
    // 1) lookup delivery method
    pipeline.push(
      ...makeLookup({
        from: 'deliverymethods',
        letLocal: 'method',
        as: 'method',
        project: { name: 1, price: 1 },
      })
    );

    // 2) lookup order basics
    pipeline.push(
      ...makeLookup({
        from: 'orders',
        letLocal: 'order',
        as: 'order',
        project: { orderNumber: 1, user: 1 },
      })
    );

    // 3) lookup user
    pipeline.push(
      ...makeLookup({
        from: 'users',
        letLocal: 'order.user',
        as: 'user',
        project: { firstName: 1, lastName: 1, email: 1, phone: 1 },
      })
    );

    // 4) unwind and lookup products
    pipeline.push(
      { $unwind: { path: '$order.product', preserveNullAndEmptyArrays: true } },
      ...makeLookup({
        from: 'products',
        letLocal: 'order.product.product',
        as: 'order.product',
        project: { name: 1, price: 1 },
      })
    );

    // 5) lookup address
    pipeline.push(
      ...makeLookup({
        from: 'addresses',
        letLocal: 'address',
        as: 'address',
        project: { address1: 1, address2: 1, postalCode: 1 },
      })
    );

    // 6) match across all searchable fields
    pipeline.push({
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
    });

    // 7) group back into full delivery docs
    pipeline.push({
      $group: {
        _id: '$_id',
        brand: { $first: '$brand' },
        order: { $first: '$order' },
        user: { $first: '$user' },
        method: { $first: '$method' },
        product: { $push: '$order.product' },
        address: { $first: '$address' },
        deliveryDate: { $first: '$deliveryDate' },
        collectionTime: { $first: '$collectionTime' },
        recipientName: { $first: '$recipientName' },
        recipientPhone: { $first: '$recipientPhone' },
        recipientEmail: { $first: '$recipientEmail' },
        woodeliveryTaskId: { $first: '$woodeliveryTaskId' },
        driverDetails: { $first: '$driverDetails' },
        status: { $first: '$status' },
        active: { $first: '$active' },
        createdAt: { $first: '$createdAt' },
        updatedAt: { $first: '$updatedAt' },
      },
    });

    // 8) final sort
    pipeline.push({ $sort: { createdAt: -1 } });

    return { pipeline, model: Delivery };
  }

  // ----- ORDER branch -----

  // 1) lookup user
  pipeline.push(
    ...makeLookup({
      from: 'users',
      letLocal: 'user',
      as: 'user',
      project: { firstName: 1, lastName: 1, email: 1, phone: 1 },
    })
  );

  // 2) lookup delivery method
  pipeline.push(
    ...makeLookup({
      from: 'deliverymethods',
      letLocal: 'delivery.method',
      as: 'delivery.method',
      project: { name: 1, price: 1 },
    })
  );

  // 3) unwind & lookup products
  pipeline.push(
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    ...makeLookup({
      from: 'products',
      letLocal: 'product.product',
      as: 'product.product',
      project: { name: 1, price: 1 },
    })
  );

  // 4) match across order fields
  pipeline.push({
    $match: {
      $or: [
        { orderNumber: s },
        { 'user.firstName': s },
        { 'user.lastName': s },
        { 'user.email': s },
        { 'user.phone': s },
        { 'recipInfo.name': s },
        { woodeliveryTaskId: s },
        { 'recipInfo.contact': { $in: [search, parseInt(search, 10)] } },
      ],
    },
  });

  // 5) group back into full order docs
  pipeline.push({
    $group: {
      _id: '$_id',
      brand: { $first: '$brand' },
      orderNumber: { $first: '$orderNumber' },
      user: { $first: '$user' },
      delivery: { $first: '$delivery' },
      product: { $push: '$product' },
      recipInfo: { $first: '$recipInfo' },
      pricingSummary: { $first: '$pricingSummary' },
      paid: { $first: '$paid' },
      active: { $first: '$active' },
      status: { $first: '$status' },
      woodeliveryTaskId: { $first: '$woodeliveryTaskId' },
      createdAt: { $first: '$createdAt' },
      updatedAt: { $first: '$updatedAt' },
    },
  });

  // 6) final sort
  pipeline.push({ $sort: { createdAt: -1 } });

  return { pipeline, model: Order };
};

export const globalTableSearch = catchAsync(
  async (req: Request, res: Response) => {
    const searchTerm = String(req.query.search || '');
    const mode = String(req.query.mode || '') as Mode;
    const brand = String(req.query.brand || '');

    const { pipeline, model } = createSearchQuery(mode, searchTerm, brand);
    const docs = await model.aggregate(pipeline).allowDiskUse(true);

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: { data: docs },
      meta: { totalDataCount: docs.length },
    });
  }
);
