/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
import Order from '@src/models/orderModel';
import Delivery from '@src/models/deliveryModel';

// Modes
type Mode = 'order' | 'delivery';

interface LookupOpts {
  from: string;
  letLocal: string;
  as: string;
  project: Record<string, 0 | 1>;
}

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
  brand: string,
  skip: number,
  limit: number
): { pipeline: any[]; model: any } => {
  const isTextSearch = !!search.trim();
  const pipeline: any[] = [];
  const regex = { $regex: new RegExp(search, 'i') };

  if (isTextSearch) {
    pipeline.push({ $match: { brand, $text: { $search: search } } });
  } else {
    pipeline.push({ $match: { brand } });
  }

  if (mode === 'delivery') {
    pipeline.push(
      ...makeLookup({
        from: 'deliverymethods',
        letLocal: 'method',
        as: 'method',
        project: { name: 1, price: 1 },
      }),
      ...makeLookup({
        from: 'orders',
        letLocal: 'order',
        as: 'order',
        project: { orderNumber: 1, user: 1 },
      }),
      ...makeLookup({
        from: 'users',
        letLocal: 'order.user',
        as: 'user',
        project: { firstName: 1, lastName: 1, email: 1, phone: 1 },
      }),
      { $unwind: { path: '$order.product', preserveNullAndEmptyArrays: true } },
      ...makeLookup({
        from: 'products',
        letLocal: 'order.product.product',
        as: 'order.product',
        project: { name: 1, price: 1 },
      }),
      ...makeLookup({
        from: 'addresses',
        letLocal: 'address',
        as: 'address',
        project: { address1: 1, address2: 1, postalCode: 1 },
      })
    );

    if (!isTextSearch) {
      pipeline.push({
        $match: {
          $or: [
            { 'customer.firstName': regex },
            { 'customer.lastName': regex },
            { 'customer.email': regex },
            { 'customer.phone': regex },
            { orderNumber: regex },
            { recipientName: regex },
            { recipientPhone: regex },
            { woodeliveryTaskId: regex },
          ],
        },
      });
    }

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
        orderNumber: { $first: '$orderNumber' },
        customer: { $first: '$customer' },
      },
    });
  } else {
    pipeline.push(
      ...makeLookup({
        from: 'users',
        letLocal: 'user',
        as: 'user',
        project: { firstName: 1, lastName: 1, email: 1, phone: 1 },
      }),
      ...makeLookup({
        from: 'deliverymethods',
        letLocal: 'delivery.method',
        as: 'delivery.method',
        project: { name: 1, price: 1 },
      }),
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      ...makeLookup({
        from: 'products',
        letLocal: 'product.product',
        as: 'product.product',
        project: { name: 1, price: 1 },
      })
    );

    if (!isTextSearch) {
      pipeline.push({
        $match: {
          $or: [
            { orderNumber: regex },
            { 'user.firstName': regex },
            { 'user.lastName': regex },
            { 'user.email': regex },
            { 'user.phone': regex },
            { 'recipInfo.name': regex },
            { woodeliveryTaskId: regex },
            { 'recipInfo.contact': { $in: [search, parseInt(search, 10)] } },
          ],
        },
      });
    }

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
  }

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
