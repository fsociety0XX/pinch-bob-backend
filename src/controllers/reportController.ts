import { NextFunction, Request, Response } from 'express';
import { PipelineStage, Types } from 'mongoose';
import catchAsync from '@src/utils/catchAsync';
import Order from '@src/models/orderModel';
import AppError from '@src/utils/appError';
import { StatusCode } from '@src/types/customTypes';

export const fetchCustomerDataByOrder = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '10';
    const brand = req.query.brand as string;

    if (!startDate || !endDate) {
      return next(
        new AppError(
          'Start date and end date are required',
          StatusCode.BAD_REQUEST
        )
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return next(
        new AppError(
          'Start date cannot be greater than end date',
          StatusCode.BAD_REQUEST
        )
      );
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const reportData = await Order.aggregate([
      // Step 1: Match Orders by Date Range and Paid Status
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paid: true,
          ...(brand && { brand }),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: '$userDetails',
      },
      {
        $addFields: {
          isNewCustomer: {
            $cond: [{ $gte: ['$userDetails.createdAt', start] }, true, false],
          },
          totalAmountValue: {
            $toDouble: {
              $ifNull: ['$pricingSummary.total', '0'],
            },
          },
        },
      },
      // Step 2: Group By Date and Calculate Orders and Amounts for Order Model
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          newCustomerOrders: { $sum: { $cond: ['$isNewCustomer', 1, 0] } },
          repeatCustomerOrders: { $sum: { $cond: ['$isNewCustomer', 0, 1] } },
          corporateOrders: { $sum: { $cond: ['$corporate', 1, 0] } },
          // Calculate Order Amounts
          newCustomerAmount: {
            $sum: { $cond: ['$isNewCustomer', '$totalAmountValue', 0] },
          },
          repeatCustomerAmount: {
            $sum: { $cond: ['$isNewCustomer', 0, '$totalAmountValue'] },
          },
          corporateAmount: {
            $sum: { $cond: ['$corporate', '$totalAmountValue', 0] },
          },
        },
      },
      // Step 3: Union with CustomiseOrder Model
      {
        $unionWith: {
          coll: 'customisecakes',
          pipeline: [
            {
              $match: {
                createdAt: { $gte: start, $lte: end },
                paid: true,
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userDetails',
              },
            },
            {
              $unwind: {
                path: '$userDetails',
                preserveNullAndEmptyArrays: false,
              },
            },
            {
              $addFields: {
                isNewCustomer: {
                  $cond: [
                    { $gte: ['$userDetails.createdAt', start] },
                    true,
                    false,
                  ],
                },
                totalAmountValue: {
                  $toDouble: {
                    $ifNull: ['$total', '0'],
                  },
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                  },
                },
                newCustomerOrders: { $sum: 0 },
                repeatCustomerOrders: { $sum: 0 },
                corporateOrders: { $sum: 0 },
                newCustomerAmount: { $sum: 0 },
                repeatCustomerAmount: { $sum: 0 },
                corporateAmount: { $sum: 0 },
                customiseCakeOrders: { $sum: 1 },
                customiseCakeAmount: { $sum: '$totalAmountValue' },
              },
            },
          ],
        },
      },
      {
        $addFields: {
          customiseCakeOrders: { $ifNull: ['$customiseCakeOrders', 0] },
          customiseCakeAmount: { $ifNull: ['$customiseCakeAmount', 0] },
        },
      },
      // Step 4: Final Grouping to Combine Data from Both Models
      {
        $group: {
          _id: '$_id',
          newCustomerOrders: { $sum: '$newCustomerOrders' },
          repeatCustomerOrders: { $sum: '$repeatCustomerOrders' },
          corporateOrders: { $sum: '$corporateOrders' },
          newCustomerAmount: { $sum: '$newCustomerAmount' },
          repeatCustomerAmount: { $sum: '$repeatCustomerAmount' },
          corporateAmount: { $sum: '$corporateAmount' },
          customiseCakeOrders: { $sum: '$customiseCakeOrders' },
          customiseCakeAmount: { $sum: '$customiseCakeAmount' },
        },
      },
      {
        $addFields: {
          totalOrders: {
            $sum: [
              '$newCustomerOrders',
              '$repeatCustomerOrders',
              '$corporateOrders',
              '$customiseCakeOrders',
            ],
          },
          totalAmount: {
            $sum: [
              '$newCustomerAmount',
              '$repeatCustomerAmount',
              '$corporateAmount',
              '$customiseCakeAmount',
            ],
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limitNum }],
        },
      },
    ]);

    const total = reportData[0].metadata[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: reportData[0].data || [],
      },
      meta: {
        page: pageNum,
        limit: limitNum,
        totalPages,
        totalCount: total,
      },
    });
  }
);

export const fetchCustomerDataByDelivery = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const page = (req.query.page as string) || '1';
    const limit = (req.query.limit as string) || '10';
    const brand = req.query.brand as string;

    if (!startDate || !endDate) {
      return next(
        new AppError(
          'Start date and end date are required',
          StatusCode.BAD_REQUEST
        )
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return next(
        new AppError(
          'Start date cannot be greater than end date',
          StatusCode.BAD_REQUEST
        )
      );
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const reportData = await Order.aggregate([
      // Step 1: Match Orders by Delivery Date and Paid Status
      {
        $addFields: {
          deliveryDateConverted: {
            $cond: [
              { $eq: [{ $type: '$delivery.date' }, 'date'] },
              '$delivery.date', // If it's already a Date, use it directly
              {
                $dateFromString: {
                  dateString: '$delivery.date',
                },
              },
            ],
          },
        },
      },
      {
        $match: {
          deliveryDateConverted: { $gte: start, $lte: end },
          paid: true,
          ...(brand && { brand }),
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: {
          path: '$userDetails',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $addFields: {
          isNewCustomer: {
            $cond: [{ $gte: ['$userDetails.createdAt', start] }, true, false],
          },
          totalAmountValue: {
            $toDouble: {
              $ifNull: ['$pricingSummary.total', '0'],
            },
          },
        },
      },
      // Step 2: Group By Delivery Date and Calculate Orders and Amounts
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$deliveryDateConverted',
            },
          },
          newCustomerOrders: { $sum: { $cond: ['$isNewCustomer', 1, 0] } },
          repeatCustomerOrders: { $sum: { $cond: ['$isNewCustomer', 0, 1] } },
          csvOrders: { $sum: { $cond: ['$corporate', 1, 0] } },
          newCustomerAmount: {
            $sum: { $cond: ['$isNewCustomer', '$totalAmountValue', 0] },
          },
          repeatCustomerAmount: {
            $sum: { $cond: ['$isNewCustomer', 0, '$totalAmountValue'] },
          },
          csvAmount: {
            $sum: { $cond: ['$corporate', '$totalAmountValue', 0] },
          },
          customiseCakeOrders: { $sum: 0 },
          customiseCakeAmount: { $sum: 0 },
        },
      },

      // Step 3: Union with CustomiseOrder Model
      {
        $unionWith: {
          coll: 'customiseorders',
          pipeline: [
            {
              $match: {
                'delivery.date': { $gte: start, $lte: end },
                paid: true,
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userDetails',
              },
            },
            {
              $unwind: {
                path: '$userDetails',
                preserveNullAndEmptyArrays: false,
              },
            },
            {
              $addFields: {
                isNewCustomer: {
                  $cond: [
                    { $gte: ['$userDetails.createdAt', start] },
                    true,
                    false,
                  ],
                },
                totalAmountValue: {
                  $toDouble: {
                    $ifNull: ['$total', '0'],
                  },
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$delivery.date',
                  },
                },
                customiseCakeOrders: { $sum: 1 },
                customiseCakeAmount: { $sum: '$totalAmountValue' },
                newCustomerOrders: { $sum: 0 },
                repeatCustomerOrders: { $sum: 0 },
                csvOrders: { $sum: 0 },
                newCustomerAmount: { $sum: 0 },
                repeatCustomerAmount: { $sum: 0 },
                csvAmount: { $sum: 0 },
              },
            },
          ],
        },
      },

      // Step 4: Final Grouping to Combine Data
      {
        $group: {
          _id: '$_id',
          newCustomerOrders: { $sum: '$newCustomerOrders' },
          repeatCustomerOrders: { $sum: '$repeatCustomerOrders' },
          csvOrders: { $sum: '$csvOrders' },
          newCustomerAmount: { $sum: '$newCustomerAmount' },
          repeatCustomerAmount: { $sum: '$repeatCustomerAmount' },
          csvAmount: { $sum: '$csvAmount' },
          customiseCakeOrders: { $sum: '$customiseCakeOrders' },
          customiseCakeAmount: { $sum: '$customiseCakeAmount' },
        },
      },

      // Step 5: Add Total Orders and Total Amount
      {
        $addFields: {
          totalOrders: {
            $sum: [
              '$newCustomerOrders',
              '$repeatCustomerOrders',
              '$csvOrders',
              '$customiseCakeOrders',
            ],
          },
          totalAmount: {
            $sum: [
              '$newCustomerAmount',
              '$repeatCustomerAmount',
              '$csvAmount',
              '$customiseCakeAmount',
            ],
          },
        },
      },

      // Step 6: Pagination
      {
        $sort: { _id: 1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limitNum }],
        },
      },
    ]);

    // Extracting Pagination Data
    const total = reportData[0]?.metadata[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: reportData[0].data || [],
      },
      meta: {
        page: pageNum,
        limit: limitNum,
        totalPages,
        totalCount: total,
      },
    });
  }
);

export const aggregatedCustomerReport = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      startDate,
      endDate,
      groupBy = 'week',
      page = '1',
      limit = '10',
      brand,
    } = req.query as {
      startDate: string;
      endDate: string;
      groupBy?: 'week' | 'month';
      page?: string;
      limit?: string;
      brand?: string;
    };

    if (!startDate || !endDate || !['week', 'month'].includes(groupBy)) {
      return next(
        new AppError('Invalid query parameters', StatusCode.BAD_REQUEST)
      );
    }

    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    const pipeline: PipelineStage[] = [
      // Step 1: Add orderType
      {
        $addFields: { orderType: 'regular' },
      },

      // Step 2: Union with customiseorders
      {
        $unionWith: {
          coll: 'customiseorders',
          pipeline: [{ $addFields: { orderType: 'customise' } }],
        },
      },

      // Step 3: Filter paid orders in date range
      {
        $match: {
          paid: true,
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
          ...(brand && { brand }),
        },
      },

      // Step 4: Lookup user
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },

      // Step 5: Add helper fields
      {
        $addFields: {
          userCreatedAt: { $arrayElemAt: ['$userDetails.createdAt', 0] },
          itemsCount: {
            $cond: {
              if: { $eq: ['$orderType', 'customise'] },
              then: { $size: '$bakes' },
              else: { $size: '$product' },
            },
          },
          isAttachOrder: {
            $cond: {
              if: { $eq: ['$orderType', 'customise'] },
              then: { $gte: [{ $size: '$bakes' }, 2] },
              else: { $gte: [{ $size: '$product' }, 2] },
            },
          },
          groupPeriod: {
            $dateToString: {
              format: groupBy === 'month' ? '%Y-%m' : '%G-W%V',
              date: '$createdAt',
            },
          },
        },
      },

      // Step 6: Group by user & period
      {
        $group: {
          _id: { user: '$user', groupPeriod: '$groupPeriod' },
          firstOrderDate: { $min: '$createdAt' },
          totalOrders: { $sum: 1 },
          totalItems: { $sum: '$itemsCount' },
          userCreatedAt: { $first: '$userCreatedAt' },
          hasAttachOrder: { $max: '$isAttachOrder' },
        },
      },

      // Step 7: Add customer type flags
      {
        $addFields: {
          isActiveAndLoyalCustomer: true,
          isNewCustomer: {
            $and: [
              {
                $eq: [
                  {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$firstOrderDate',
                    },
                  },
                  {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$userCreatedAt',
                    },
                  },
                ],
              },
              { $gte: ['$firstOrderDate', new Date(startDate)] },
              { $lte: ['$firstOrderDate', new Date(endDate)] },
            ],
          },
          isRepeatCustomer: { $gt: ['$totalOrders', 1] },
          isAttachCustomer: { $eq: ['$hasAttachOrder', true] },
        },
      },

      // Step 8: Final group by period
      {
        $group: {
          _id: '$_id.groupPeriod',
          loyalCustomerCount: {
            $sum: { $cond: ['$isActiveAndLoyalCustomer', 1, 0] },
          },
          newCustomerCount: { $sum: { $cond: ['$isNewCustomer', 1, 0] } },
          repeatCustomerCount: { $sum: { $cond: ['$isRepeatCustomer', 1, 0] } },
          attachCustomerCount: { $sum: { $cond: ['$isAttachCustomer', 1, 0] } },
          totalCustomerCount: { $sum: 1 },
        },
      },

      // Step 9: Format output
      {
        $project: {
          _id: 0,
          period: '$_id',
          newCustomerCount: 1,
          repeatCustomerCount: 1,
          attachCustomerCount: 1,
          loyalCustomerCount: 1,
          totalCustomerCount: 1,
        },
      },

      // Step 10: Sort and paginate
      {
        $sort: { period: 1 },
      },
      {
        $facet: {
          paginatedResults: [{ $skip: skip }, { $limit: pageSize }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const result = await Order.aggregate(pipeline);

    const reportData = result[0]?.paginatedResults || [];
    const totalCount = result[0]?.totalCount?.[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: reportData || [],
      },
      meta: {
        page: pageNumber,
        limit: pageSize,
        totalCount,
        totalPages,
      },
    });
  }
);

const escapeRegex = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const productReport = catchAsync(async (req: Request, res: Response) => {
  const startDate = new Date(req.query.startDate as string);
  const endDate = new Date(req.query.endDate as string);
  const brand = req.query.brand as string;
  const page = +(req.query.page as string) || 1;
  const limit = +(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const sortBy = (req.query.sortBy as string) || 'noOfItems';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  const search = (req.query.search as string) || '';
  const category = req.query.category as string;
  const superCategory = req.query.superCategory as string;

  const aggregationPipeline: PipelineStage[] = [
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        brand,
        paid: true,
      },
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.product',
        noOfItems: { $sum: '$product.quantity' },
        totalOrderValue: {
          $sum: { $multiply: ['$product.price', '$product.quantity'] },
        },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productDetails',
      },
    },
    { $unwind: '$productDetails' },

    // Optional search and filtering
    {
      $match: {
        ...(search && {
          'productDetails.name': { $regex: escapeRegex(search), $options: 'i' },
        }),
        ...(category && {
          'productDetails.category': new Types.ObjectId(category),
        }),
        ...(superCategory && {
          'productDetails.superCategory': new Types.ObjectId(superCategory),
        }),
      },
    },

    // Single Category lookup
    {
      $lookup: {
        from: 'categories',
        localField: 'productDetails.category',
        foreignField: '_id',
        as: 'categoryDetails',
      },
    },
    {
      $lookup: {
        from: 'supercategories',
        localField: 'productDetails.superCategory',
        foreignField: '_id',
        as: 'superCategoryDetails',
      },
    },

    {
      $addFields: {
        productDetails: {
          _id: '$productDetails._id',
          name: '$productDetails.name',
          category: { $arrayElemAt: ['$categoryDetails', 0] },
          superCategory: { $arrayElemAt: ['$superCategoryDetails', 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        product: {
          id: { $toString: '$productDetails._id' },
          name: '$productDetails.name',
          category: {
            $cond: [
              { $ifNull: ['$productDetails.category', false] },
              {
                id: { $toString: '$productDetails.category._id' },
                name: '$productDetails.category.name',
              },
              null,
            ],
          },
          superCategory: {
            $cond: [
              { $ifNull: ['$productDetails.superCategory', false] },
              {
                id: { $toString: '$productDetails.superCategory._id' },
                name: '$productDetails.superCategory.name',
              },
              null,
            ],
          },
        },
        noOfItems: 1,
        totalOrderValue: 1,
      },
    },
    {
      $facet: {
        data: [
          { $sort: { [sortBy]: sortOrder } },
          { $skip: skip },
          { $limit: limit },
        ],
        totalCount: [{ $count: 'count' }],
      },
    },
  ];

  const result = await Order.aggregate(aggregationPipeline);

  const reportData = result[0]?.data || [];
  const totalCount = result[0]?.totalCount[0]?.count || 0;

  res.status(StatusCode.SUCCESS).json({
    status: 'success',
    data: {
      data: reportData,
    },
    meta: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
});
