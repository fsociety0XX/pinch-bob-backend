import { NextFunction, Request, Response } from 'express';
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
        currentPage: pageNum,
        totalPages,
        totalRecords: total,
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
        currentPage: pageNum,
        totalPages,
        totalRecords: total,
      },
    });
  }
);
