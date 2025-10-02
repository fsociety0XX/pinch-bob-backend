import { NextFunction, Request, Response } from 'express';
import { PipelineStage, Types } from 'mongoose';
import catchAsync from '@src/utils/catchAsync';
import Order from '@src/models/orderModel';
import AppError from '@src/utils/appError';
import { CANCELLED, StatusCode } from '@src/types/customTypes';

// Constants for excluded products from reports
const EXCLUDED_PRODUCT_IDS = {
  BIRTHDAY_KIT: '67f72f6fc8364d1b276fde2a',
  EXCLUDED_PRODUCT: '68786052ab31550a66870f47',
} as const;

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

    // Convert filter dates to account for Singapore timezone (UTC+8)
    // When filtering for Aug 20 SGT, we need to include orders from Aug 19 16:00 UTC to Aug 20 16:00 UTC
    // Note: Only including orders with HitPay payment details (excluding orders without hitpayDetails.paymentDate)
    const sgTimezoneOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

    // Adjust start date: subtract 8 hours to capture Singapore timezone start
    const adjustedStart = new Date(start.getTime() - sgTimezoneOffset);

    // Adjust end date: subtract 8 hours and add 1 millisecond to capture Singapore timezone end
    const adjustedEnd = new Date(end.getTime() - sgTimezoneOffset + 1);

    // Preserve exact time components from input (like getAllOrder function)
    // No normalization to beginning/end of day

    // Validate dates
    if (
      Number.isNaN(adjustedStart.getTime()) ||
      Number.isNaN(adjustedEnd.getTime())
    ) {
      return next(
        new AppError('Invalid date format provided', StatusCode.BAD_REQUEST)
      );
    }

    if (adjustedStart > adjustedEnd) {
      return next(
        new AppError(
          'Start date cannot be greater than end date',
          StatusCode.BAD_REQUEST
        )
      );
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Validate pagination parameters
    if (pageNum < 1 || limitNum < 1 || limitNum > 600) {
      return next(
        new AppError(
          'Invalid pagination parameters. Page must be >= 1 and limit must be between 1-600',
          StatusCode.BAD_REQUEST
        )
      );
    }

    const skip = (pageNum - 1) * limitNum;

    const reportData = await Order.aggregate([
      // Step 1: Match Orders by Date Range, Paid Status, and HitPay Details Only
      {
        $match: {
          'hitpayDetails.paymentDate': {
            $gte: adjustedStart,
            $lte: adjustedEnd,
            $exists: true,
          },
          paid: true,
          status: { $ne: CANCELLED },
          ...(brand && { brand }),
        },
      },
      // Step 2: Add computed field for payment date (only HitPay orders now)
      {
        $addFields: {
          effectivePaymentDate: '$hitpayDetails.paymentDate',
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
          totalAmountValue: {
            $convert: {
              input: '$pricingSummary.total',
              to: 'double',
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      // Step 3: Group By Date and Calculate Orders and Amounts
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $add: ['$effectivePaymentDate', 8 * 60 * 60 * 1000], // Convert to SGT for grouping
              },
            },
          },
          orders: { $push: '$$ROOT' },
          users: { $addToSet: '$user' },
        },
      },
      // Get first order date for all users in this batch (HitPay orders only for new customer determination)
      {
        $lookup: {
          from: 'orders',
          let: { userIds: '$users' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$user', '$$userIds'] },
                'hitpayDetails.paymentDate': { $exists: true },
                paid: true,
              },
            },
            {
              $group: {
                _id: '$user',
                firstOrderDate: { $min: '$hitpayDetails.paymentDate' },
              },
            },
          ],
          as: 'userFirstOrders',
        },
      },
      { $unwind: '$orders' },
      {
        $addFields: {
          'orders.isNewCustomer': {
            $let: {
              vars: {
                userFirstOrder: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$userFirstOrders',
                        cond: { $eq: ['$$this._id', '$orders.user'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: {
                // A customer is "new" if this order IS their very first order ever (HitPay only)
                $eq: [
                  '$orders.effectivePaymentDate',
                  '$$userFirstOrder.firstOrderDate',
                ],
              },
            },
          },
        },
      },
      {
        $replaceRoot: { newRoot: '$orders' },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $add: ['$effectivePaymentDate', 8 * 60 * 60 * 1000], // Convert to SGT for grouping
              },
            },
          },
          // Customer Type Segmentation (excluding corporate orders)
          newCustomerOrders: {
            $sum: {
              $cond: [
                {
                  $and: ['$isNewCustomer', { $ne: ['$corporate', true] }],
                },
                1,
                0,
              ],
            },
          },
          // Collect order IDs for new customers (non-corporate)
          newCustomerOrderIds: {
            $push: {
              $cond: [
                {
                  $and: ['$isNewCustomer', { $ne: ['$corporate', true] }],
                },
                '$_id',
                '$$REMOVE',
              ],
            },
          },
          repeatCustomerOrders: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: '$isNewCustomer' },
                    { $ne: ['$corporate', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          // Collect order IDs for repeat customers (non-corporate)
          repeatCustomerOrderIds: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $not: '$isNewCustomer' },
                    { $ne: ['$corporate', true] },
                  ],
                },
                '$_id',
                '$$REMOVE',
              ],
            },
          },
          // Order Type Segmentation (excluding corporate orders)
          regularOrders: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$customiseCakeForm', true] },
                    { $ne: ['$corporate', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          customiseCakeOrders: {
            $sum: {
              $cond: [
                {
                  $and: ['$customiseCakeForm', { $ne: ['$corporate', true] }],
                },
                1,
                0,
              ],
            },
          },
          // Corporate Orders - set to 0 for now (will be calculated separately)
          csvOrders: { $sum: 0 },
          // Calculate Amounts by Customer Type (excluding corporate orders)
          newCustomerAmount: {
            $sum: {
              $cond: [
                {
                  $and: ['$isNewCustomer', { $ne: ['$corporate', true] }],
                },
                '$totalAmountValue',
                0,
              ],
            },
          },
          repeatCustomerAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: '$isNewCustomer' },
                    { $ne: ['$corporate', true] },
                  ],
                },
                '$totalAmountValue',
                0,
              ],
            },
          },
          // Calculate Amounts by Order Type (excluding corporate orders)
          regularAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$customiseCakeForm', true] },
                    { $ne: ['$corporate', true] },
                  ],
                },
                '$totalAmountValue',
                0,
              ],
            },
          },
          customiseCakeAmount: {
            $sum: {
              $cond: [
                {
                  $and: ['$customiseCakeForm', { $ne: ['$corporate', true] }],
                },
                '$totalAmountValue',
                0,
              ],
            },
          },
          // Corporate Amount - set to 0 for now (will be calculated separately)
          csvAmount: { $sum: 0 },
        },
      },
      {
        $addFields: {
          // Total Orders and Amount (excluding corporate orders)
          // By Customer Type: New + Repeat (Corporate orders are shown separately)
          totalOrders: {
            $sum: ['$newCustomerOrders', '$repeatCustomerOrders'],
          },
          totalAmount: {
            $sum: ['$newCustomerAmount', '$repeatCustomerAmount'],
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

    // Separate aggregation to get corporate orders for each date
    const corporateData = await Order.aggregate([
      {
        $match: {
          $or: [
            // HitPay corporate orders
            {
              $and: [
                {
                  'hitpayDetails.paymentDate': {
                    $gte: adjustedStart,
                    $lte: adjustedEnd,
                  },
                },
                { 'hitpayDetails.paymentDate': { $exists: true } },
                { corporate: true },
              ],
            },
            // CSV/Corporate orders without HitPay details
            {
              'hitpayDetails.paymentDate': { $exists: false },
              createdAt: {
                $gte: adjustedStart,
                $lte: adjustedEnd,
              },
              corporate: true,
            },
          ],
          paid: true,
          status: { $ne: CANCELLED },
          ...(brand && { brand }),
        },
      },
      {
        $addFields: {
          effectivePaymentDate: {
            $cond: {
              if: { $ifNull: ['$hitpayDetails.paymentDate', false] },
              then: '$hitpayDetails.paymentDate',
              else: '$createdAt',
            },
          },
          totalAmountValue: {
            $convert: {
              input: '$pricingSummary.total',
              to: 'double',
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $add: ['$effectivePaymentDate', 8 * 60 * 60 * 1000], // Convert to SGT
              },
            },
          },
          csvOrders: { $sum: 1 },
          csvAmount: { $sum: '$totalAmountValue' },
        },
      },
    ]);

    // Merge corporate data with main report data
    const corporateMap = new Map(corporateData.map((item) => [item._id, item]));

    const enrichedData = reportData[0].data.map(
      (item: Record<string, unknown>) => ({
        ...item,
        csvOrders: corporateMap.get(item._id as string)?.csvOrders || 0,
        csvAmount: corporateMap.get(item._id as string)?.csvAmount || 0,
      })
    );

    const total = reportData[0]?.metadata?.[0]?.total || 0;
    const totalPages = total > 0 ? Math.ceil(total / limitNum) : 0;

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: enrichedData,
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

    // Preserve exact time components from input (like getAllOrder function)
    // No normalization to beginning/end of day

    // Validate dates
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return next(
        new AppError('Invalid date format provided', StatusCode.BAD_REQUEST)
      );
    }

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

    // Validate pagination parameters
    if (pageNum < 1 || limitNum < 1 || limitNum > 600) {
      return next(
        new AppError(
          'Invalid pagination parameters. Page must be >= 1 and limit must be between 1-600',
          StatusCode.BAD_REQUEST
        )
      );
    }

    const skip = (pageNum - 1) * limitNum;

    const reportData = await Order.aggregate([
      // Step 1: Convert delivery date to ensure it's a proper Date type
      {
        $addFields: {
          deliveryDateConverted: {
            $cond: [
              { $eq: [{ $type: '$delivery.date' }, 'date'] },
              '$delivery.date', // If it's already a Date, use it directly
              {
                $dateFromString: {
                  dateString: '$delivery.date',
                  onError: null, // Handle invalid date strings gracefully
                },
              },
            ],
          },
        },
      },
      // Step 2: Match Orders by Delivery Date and Paid Status
      {
        $match: {
          deliveryDateConverted: { $gte: start, $lte: end, $ne: null },
          paid: true,
          status: { $ne: CANCELLED },
          ...(brand ? { brand } : {}),
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
          totalAmountValue: {
            $convert: {
              input: '$pricingSummary.total',
              to: 'double',
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      // Step 3: Group By Delivery Date and Calculate Orders and Amounts
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$deliveryDateConverted',
            },
          },
          orders: { $push: '$$ROOT' },
          users: { $addToSet: '$user' },
        },
      },
      // Get first order date for all users in this batch (much more efficient)
      {
        $lookup: {
          from: 'orders',
          let: { userIds: '$users' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$user', '$$userIds'] },
                paid: true,
                status: { $ne: CANCELLED },
              },
            },
            {
              $addFields: {
                effectivePaymentDate: {
                  $cond: {
                    if: { $ifNull: ['$hitpayDetails.paymentDate', false] },
                    then: '$hitpayDetails.paymentDate',
                    else: '$createdAt',
                  },
                },
              },
            },
            {
              $group: {
                _id: '$user',
                firstOrderDate: { $min: '$effectivePaymentDate' },
              },
            },
          ],
          as: 'userFirstOrders',
        },
      },
      { $unwind: '$orders' },
      {
        $addFields: {
          'orders.isNewCustomer': {
            $let: {
              vars: {
                userFirstOrder: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$userFirstOrders',
                        cond: { $eq: ['$$this._id', '$orders.user'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: {
                // A customer is "new" if this order IS their very first order ever
                $eq: [
                  {
                    $cond: {
                      if: {
                        $ifNull: ['$orders.hitpayDetails.paymentDate', false],
                      },
                      then: '$orders.hitpayDetails.paymentDate',
                      else: '$orders.createdAt',
                    },
                  },
                  '$$userFirstOrder.firstOrderDate',
                ],
              },
            },
          },
        },
      },
      {
        $replaceRoot: { newRoot: '$orders' },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$deliveryDateConverted',
            },
          },
          // Customer Type Segmentation (excluding corporate orders)
          newCustomerOrders: {
            $sum: {
              $cond: [
                {
                  $and: ['$isNewCustomer', { $ne: ['$corporate', true] }],
                },
                1,
                0,
              ],
            },
          },
          // Collect order IDs for new customers (non-corporate)
          newCustomerOrderIds: {
            $push: {
              $cond: [
                {
                  $and: ['$isNewCustomer', { $ne: ['$corporate', true] }],
                },
                '$_id',
                '$$REMOVE',
              ],
            },
          },
          repeatCustomerOrders: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: '$isNewCustomer' },
                    { $ne: ['$corporate', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          // Collect order IDs for repeat customers (non-corporate)
          repeatCustomerOrderIds: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $not: '$isNewCustomer' },
                    { $ne: ['$corporate', true] },
                  ],
                },
                '$_id',
                '$$REMOVE',
              ],
            },
          },
          // Order Type Segmentation (excluding corporate orders)
          regularOrders: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$customiseCakeForm', true] },
                    { $ne: ['$corporate', true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          customiseCakeOrders: {
            $sum: {
              $cond: [
                {
                  $and: ['$customiseCakeForm', { $ne: ['$corporate', true] }],
                },
                1,
                0,
              ],
            },
          },
          // Corporate Orders (separate category) - keeping csvOrders name for compatibility
          csvOrders: { $sum: { $cond: ['$corporate', 1, 0] } },
          // Calculate Amounts by Customer Type (excluding corporate orders)
          newCustomerAmount: {
            $sum: {
              $cond: [
                {
                  $and: ['$isNewCustomer', { $ne: ['$corporate', true] }],
                },
                '$totalAmountValue',
                0,
              ],
            },
          },
          repeatCustomerAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: '$isNewCustomer' },
                    { $ne: ['$corporate', true] },
                  ],
                },
                '$totalAmountValue',
                0,
              ],
            },
          },
          // Calculate Amounts by Order Type (excluding corporate orders)
          regularAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$customiseCakeForm', true] },
                    { $ne: ['$corporate', true] },
                  ],
                },
                '$totalAmountValue',
                0,
              ],
            },
          },
          customiseCakeAmount: {
            $sum: {
              $cond: [
                {
                  $and: ['$customiseCakeForm', { $ne: ['$corporate', true] }],
                },
                '$totalAmountValue',
                0,
              ],
            },
          },
          // Corporate Amount (separate category) - keeping csvAmount name for compatibility
          csvAmount: {
            $sum: { $cond: ['$corporate', '$totalAmountValue', 0] },
          },
        },
      },
      // Step 3: Add Total Orders and Total Amount (excluding corporate orders)
      {
        $addFields: {
          // Total by Customer Type: New + Repeat (Corporate orders are shown separately)
          totalOrders: {
            $sum: ['$newCustomerOrders', '$repeatCustomerOrders'],
          },
          totalAmount: {
            $sum: ['$newCustomerAmount', '$repeatCustomerAmount'],
          },
        },
      },
      // Step 4: Pagination
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
    const total = reportData[0]?.metadata?.[0]?.total || 0;
    const totalPages = total > 0 ? Math.ceil(total / limitNum) : 0;

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

    // Preserve exact time components from input (like getAllOrder function)
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    // Create base match for paid orders
    const baseMatch = {
      paid: true,
      status: { $ne: CANCELLED },
      ...(brand ? { brand } : {}),
    };

    // Create date filter that works for both HitPay and CSV orders
    const dateFilter = {
      $or: [
        // HitPay orders: use hitpayDetails.paymentDate
        {
          $and: [
            {
              'hitpayDetails.paymentDate': {
                $gte: startDateObj,
                $lte: endDateObj,
              },
            },
            { 'hitpayDetails.paymentDate': { $exists: true } },
          ],
        },
        // CSV/Corporate orders: use createdAt when hitpayDetails.paymentDate doesn't exist
        {
          'hitpayDetails.paymentDate': { $exists: false },
          createdAt: { $gte: startDateObj, $lte: endDateObj },
        },
      ],
    };

    const dateMatch = { ...baseMatch, ...dateFilter };

    const pipeline: PipelineStage[] = [
      // Step 1: Filter paid orders in date range
      {
        $match: dateMatch,
      },
      // Step 2: Add orderType based on customiseCakeForm flag
      {
        $addFields: {
          orderType: {
            $cond: ['$customiseCakeForm', 'customise', 'regular'],
          },
        },
      },

      // Step 3: Lookup user
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },

      // Step 4: Add helper fields
      {
        $addFields: {
          userCreatedAt: { $arrayElemAt: ['$userDetails.createdAt', 0] },
          groupPeriod: {
            $dateToString: {
              format: groupBy === 'month' ? '%Y-%m' : '%G-W%V',
              date: {
                $cond: {
                  if: {
                    $ifNull: ['$hitpayDetails.paymentDate', false],
                  },
                  then: '$hitpayDetails.paymentDate',
                  else: '$createdAt',
                },
              },
            },
          },
        },
      },

      // Step 4a: Lookup CustomiseCake details for item counting
      {
        $lookup: {
          from: 'customisecakes',
          localField: 'customiseCakeFormDetails',
          foreignField: '_id',
          as: 'customiseCakeDetails',
        },
      },

      // Step 4b: Calculate accurate item counts
      {
        $addFields: {
          itemsCount: {
            $cond: {
              if: { $eq: ['$orderType', 'customise'] },
              then: {
                $let: {
                  vars: {
                    customiseCake: {
                      $arrayElemAt: ['$customiseCakeDetails', 0],
                    },
                  },
                  in: {
                    $add: [
                      { $size: { $ifNull: ['$$customiseCake.bakes', []] } },
                      {
                        $size: {
                          $ifNull: ['$$customiseCake.candlesAndSparklers', []],
                        },
                      },
                    ],
                  },
                },
              },
              else: { $size: { $ifNull: ['$product', []] } },
            },
          },
          isAttachOrder: {
            $cond: {
              if: { $eq: ['$orderType', 'customise'] },
              then: {
                $let: {
                  vars: {
                    customiseCake: {
                      $arrayElemAt: ['$customiseCakeDetails', 0],
                    },
                  },
                  in: {
                    $gte: [
                      {
                        $add: [
                          { $size: { $ifNull: ['$$customiseCake.bakes', []] } },
                          {
                            $size: {
                              $ifNull: [
                                '$$customiseCake.candlesAndSparklers',
                                [],
                              ],
                            },
                          },
                        ],
                      },
                      2,
                    ],
                  },
                },
              },
              else: { $gte: [{ $size: { $ifNull: ['$product', []] } }, 2] },
            },
          },
        },
      },

      // Step 5: Group by period and collect all orders and users
      {
        $group: {
          _id: '$groupPeriod',
          orders: { $push: '$$ROOT' },
          users: { $addToSet: '$user' },
        },
      },

      // Step 6: Get first order date for all users (efficient batch lookup)
      {
        $lookup: {
          from: 'orders',
          let: { userIds: '$users' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$user', '$$userIds'] },
                paid: true,
                status: { $ne: CANCELLED },
              },
            },
            {
              $group: {
                _id: '$user',
                firstOrderDate: {
                  $min: {
                    $cond: {
                      if: {
                        $ifNull: ['$hitpayDetails.paymentDate', false],
                      },
                      then: '$hitpayDetails.paymentDate',
                      else: '$createdAt',
                    },
                  },
                },
              },
            },
          ],
          as: 'userFirstOrders',
        },
      },

      // Step 7: Unwind orders and add customer classification
      { $unwind: '$orders' },
      {
        $addFields: {
          'orders.isNewCustomer': {
            $let: {
              vars: {
                userFirstOrder: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$userFirstOrders',
                        cond: { $eq: ['$$this._id', '$orders.user'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: {
                // A customer is "new" if this order IS their very first order ever
                $eq: [
                  {
                    $cond: {
                      if: {
                        $ifNull: ['$orders.hitpayDetails.paymentDate', false],
                      },
                      then: '$orders.hitpayDetails.paymentDate',
                      else: '$orders.createdAt',
                    },
                  },
                  '$$userFirstOrder.firstOrderDate',
                ],
              },
            },
          },
        },
      },

      // Step 8: Group by user and period to calculate customer metrics
      {
        $group: {
          _id: { user: '$orders.user', groupPeriod: '$_id' },
          firstOrderDate: {
            $min: {
              $cond: {
                if: {
                  $ifNull: ['$orders.hitpayDetails.paymentDate', false],
                },
                then: '$orders.hitpayDetails.paymentDate',
                else: '$orders.createdAt',
              },
            },
          },
          totalOrders: { $sum: 1 },
          totalItems: { $sum: '$orders.itemsCount' },
          hasAttachOrder: { $max: '$orders.isAttachOrder' },
          isNewCustomer: { $max: '$orders.isNewCustomer' }, // At least one order is "new" (should be consistent for all orders of same user in period)
        },
      },

      // Step 9: Add customer type flags
      {
        $addFields: {
          isActiveAndLoyalCustomer: true,
          isRepeatCustomer: { $gt: ['$totalOrders', 1] },
          isAttachCustomer: { $eq: ['$hasAttachOrder', true] },
        },
      },

      // Step 10: Final group by period
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

      // Step 11: Format output
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

      // Step 12: Sort and paginate
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
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

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

  // Preserve exact time components from input (like getAllOrder function)
  // No normalization to beginning/end of day

  const brand = req.query.brand as string;
  const page = +(req.query.page as string) || 1;
  const limit = +(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const sortBy = (req.query.sortBy as string) || 'noOfItems';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  const search = (req.query.search as string) || '';
  const category = req.query.category as string;
  const superCategory = req.query.superCategory as string;

  // Validate required fields
  if (!brand) {
    return res.status(StatusCode.BAD_REQUEST).json({
      status: 'error',
      message: 'Brand is required for product report',
    });
  }

  const aggregationPipeline: PipelineStage[] = [
    {
      $match: {
        $or: [
          // HitPay orders: use hitpayDetails.paymentDate
          {
            $and: [
              {
                'hitpayDetails.paymentDate': {
                  $gte: startDate,
                  $lte: endDate,
                },
              },
              { 'hitpayDetails.paymentDate': { $exists: true } },
            ],
          },
          // CSV/Corporate orders: use createdAt when hitpayDetails.paymentDate doesn't exist
          {
            'hitpayDetails.paymentDate': { $exists: false },
            createdAt: { $gte: startDate, $lte: endDate },
          },
        ],
        brand,
        paid: true,
        status: { $ne: CANCELLED },
      },
    },
    // Add total amount conversion for later use
    {
      $addFields: {
        totalAmountValue: {
          $convert: {
            input: '$pricingSummary.total',
            to: 'double',
            onError: 0,
            onNull: 0,
          },
        },
      },
    },
    // Handle regular orders - extract products from product array
    {
      $addFields: {
        allProducts: {
          $map: {
            input: { $ifNull: ['$product', []] },
            as: 'item',
            in: {
              product: '$$item.product', // In aggregation, this is ObjectId
              quantity: '$$item.quantity',
              price: '$$item.price',
              isCustomForm: false,
            },
          },
        },
      },
    },
    // Add lookup for customise cake details and extract products
    {
      $lookup: {
        from: 'customisecakes',
        localField: 'customiseCakeFormDetails',
        foreignField: '_id',
        as: 'customiseCakeDetails',
      },
    },
    // Add products from customise cake orders
    {
      $addFields: {
        customiseCakeProducts: {
          $cond: [
            { $eq: ['$customiseCakeForm', true] },
            {
              $let: {
                vars: {
                  customiseCake: { $arrayElemAt: ['$customiseCakeDetails', 0] },
                },
                in: {
                  $concatArrays: [
                    // Bakes products from customise cake
                    {
                      $map: {
                        input: { $ifNull: ['$$customiseCake.bakes', []] },
                        as: 'bake',
                        in: {
                          product: '$$bake.product',
                          quantity: '$$bake.quantity',
                          price: 0, // Will be replaced with actual product.price in grouping stage
                          isCustomForm: true,
                        },
                      },
                    },
                    // Candles and sparklers from customise cake
                    {
                      $map: {
                        input: {
                          $ifNull: ['$$customiseCake.candlesAndSparklers', []],
                        },
                        as: 'candle',
                        in: {
                          product: '$$candle.product',
                          quantity: '$$candle.quantity',
                          price: 0, // Will be replaced with actual product.price in grouping stage
                          isCustomForm: true,
                        },
                      },
                    },
                  ],
                },
              },
            },
            [],
          ],
        },
      },
    },
    // Combine all products
    {
      $addFields: {
        allProducts: {
          $concatArrays: [
            '$allProducts',
            { $ifNull: ['$customiseCakeProducts', []] },
          ],
        },
      },
    },
    { $unwind: { path: '$allProducts', preserveNullAndEmptyArrays: false } },
    // Filter out products where product is null (main custom cakes without specific product reference)
    // Also exclude "Birthday Kit" product and specified product
    {
      $match: {
        'allProducts.product': {
          $nin: [
            null,
            new Types.ObjectId(EXCLUDED_PRODUCT_IDS.BIRTHDAY_KIT),
            new Types.ObjectId(EXCLUDED_PRODUCT_IDS.EXCLUDED_PRODUCT),
          ],
        },
      },
    },
    // Lookup product details first to get the price
    {
      $lookup: {
        from: 'products',
        localField: 'allProducts.product',
        foreignField: '_id',
        as: 'productInfo',
      },
    },
    { $unwind: '$productInfo' },
    {
      $group: {
        _id: '$allProducts.product',
        noOfItems: { $sum: { $ifNull: ['$allProducts.quantity', 0] } },
        totalOrderValue: {
          $sum: {
            $multiply: [
              { $ifNull: ['$allProducts.quantity', 0] },
              { $ifNull: ['$allProducts.price', '$productInfo.price'] },
            ],
          },
        },
        productDetails: { $first: '$productInfo' },
      },
    },

    // Category lookups - handle arrays
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

    // Optional search and filtering
    {
      $match: {
        ...(search && {
          'productDetails.name': { $regex: escapeRegex(search), $options: 'i' },
        }),
        ...(category && {
          'productDetails.category': {
            $in: [new Types.ObjectId(category)],
          },
        }),
        ...(superCategory && {
          'productDetails.superCategory': {
            $in: [new Types.ObjectId(superCategory)],
          },
        }),
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
  const totalCount = result[0]?.totalCount?.[0]?.count || 0;

  res.status(StatusCode.SUCCESS).json({
    status: 'success',
    data: {
      data: reportData,
    },
    meta: {
      page,
      limit,
      totalCount,
      totalPages: totalCount > 0 ? Math.ceil(totalCount / limit) : 0,
    },
  });
});
