/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { NextFunction, Request, Response } from 'express';
import moment from 'moment';
import {
  ASSIGN_TASK_TO_DRIVER,
  GET_WOODELIVERY_DRIVERS,
  WOODELIVERY_TASK,
} from '@src/constants/routeConstants';
import { brandEnum, CANCELLED, StatusCode } from '@src/types/customTypes';
import catchAsync from '@src/utils/catchAsync';
import { fetchAPI } from '@src/utils/functions';
import Delivery from '@src/models/deliveryModel';
import Order from '@src/models/orderModel';
import { WOODELIVERY_STATUS } from '@src/constants/static';
import {
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';
import sendEmail from '@src/utils/sendEmail';
import {
  ASSIGN_ORDER_ERROR,
  BOB_SMS_CONTENT,
  DELIVERY_COLLECTION_TIME,
  NO_DATA_FOUND,
  PINCH_EMAILS,
} from '@src/constants/messages';
import AppError from '@src/utils/appError';
import sendSms from '@src/utils/sendTwilioOtp';
import logActivity, { ActivityActions } from '@src/utils/activityLogger';

export const getAllDrivers = catchAsync(async (req: Request, res: Response) => {
  const response = await fetchAPI(GET_WOODELIVERY_DRIVERS, 'GET');
  const drivers = await response.json();
  res.status(StatusCode.SUCCESS).json({
    status: 'success',
    data: {
      data: drivers.data,
    },
  });
});

export const getServerTime = catchAsync(async (req: Request, res: Response) => {
  const serverDateTime = new Date();
  res.status(StatusCode.SUCCESS).json({
    status: 'success',
    data: {
      data: serverDateTime,
    },
  });
});

export const assignOrderToDriver = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const deliveryId = req.params.id;
    const { driverDetails, woodeliveryTaskId } = req.body;
    const before = await Delivery.findById(deliveryId);

    if (!before) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    if (!driverDetails || !woodeliveryTaskId) {
      return next(new AppError(ASSIGN_ORDER_ERROR, StatusCode.BAD_REQUEST));
    }

    const assignOrder = [
      {
        taskGuid: woodeliveryTaskId,
        driverUserId: driverDetails.id,
      },
    ];
    await fetchAPI(ASSIGN_TASK_TO_DRIVER, 'POST', assignOrder);

    const doc = await Delivery.findByIdAndUpdate(
      deliveryId,
      { driverDetails },
      { new: true }
    );

    if (doc && req.user) {
      await logActivity({
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
        action: ActivityActions.UPDATE_DELIVERY,
        module: 'delivery',
        targetId: doc._id.toString(),
        metadata: {
          before,
          after: doc,
        },
        brand: req.brand,
      });
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  }
);

export const unassignDriver = catchAsync(
  async (req: Request, res: Response) => {
    const deliveryId = req.params.id;
    const { woodeliveryTaskId } = req.body;

    const reqBody = [
      {
        taskGuid: woodeliveryTaskId,
        statusId: 10, // Id 10 is for Unassign - Check API documention or WOODELIVERY_STATUS variable for details
      },
    ];
    await fetchAPI(`${WOODELIVERY_TASK}/status`, 'POST', reqBody);

    const before = await Delivery.findById(deliveryId);

    const doc = await Delivery.findByIdAndUpdate(
      deliveryId,
      { driverDetails: null },
      { new: true }
    );

    if (doc && req.user) {
      await logActivity({
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
        action: ActivityActions.UPDATE_DELIVERY,
        module: 'delivery',
        targetId: doc._id.toString(),
        metadata: {
          before,
          after: doc,
        },
        brand: req.brand,
      });
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  }
);

// This is a webhook which is called by woodelivery on every status change
export const updateOrderStatus = catchAsync(
  // eslint-disable-next-line consistent-return
  async (req: Request, res: Response) => {
    const { subject, template, previewText } = PINCH_EMAILS.reqForReview;
    const orderNumber = req.params.id;
    const { brand } = req.query;

    const order = await Order.findOne({ orderNumber, brand });
    if (!order) {
      // Status code MUST be 200 here else woodelivery will mark webhook as invalid - can be removed after bob launch
      return res.status(StatusCode.SUCCESS).json({
        status: 'not found',
        message: `No order found with order number: ${orderNumber} for ${brand}`,
      });
      // return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
    }
    await Delivery.findOneAndUpdate(
      { order: order?._id },
      {
        status: WOODELIVERY_STATUS[req.body.StatusId],
      }
    );
    await Order.findByIdAndUpdate(order?._id, {
      status: WOODELIVERY_STATUS[req.body.StatusId],
    });

    // Send order delivered email and ask for google review from cx
    if (WOODELIVERY_STATUS[req.body.StatusId] === 'Completed') {
      // Send SMS via Twilio for Bob
      if (brand === brandEnum[1]) {
        let body = '';
        if (order.corporate) {
          body = BOB_SMS_CONTENT.corporateDelivered;
        } else {
          body = BOB_SMS_CONTENT.regularDelivered(
            order.recipInfo?.name || order.user.firstName || ''
          );
        }
        const phone =
          order.recipInfo?.contact ||
          order.delivery.address.phone ||
          order.user.phone;

        await sendSms(body, phone as string);
      }

      await sendEmail({
        email: order?.user?.email,
        subject,
        template,
        context: {
          previewText,
          orderNo: order.orderNumber || '',
          customerName: `${order!.user?.firstName || ''} ${
            order!.user?.lastName || ''
          }`,
        },
        brand: brand as string,
      });
    }
    res.send(StatusCode.SUCCESS);
  }
);

const convertTo24Hour = (time: string) => {
  // Handle various time formats: "9:00am", "12:30pm", "3:00 PM", "6:30 pm", etc.
  const formats = [
    'h:mma', // 9:00am
    'h:mm a', // 9:00 am
    'h:mmA', // 9:00AM
    'h:mm A', // 9:00 AM
    'ha', // 9am
    'h a', // 9 am
    'hA', // 9AM
    'h A', // 9 AM
    'HH:mm', // 24-hour format (just in case)
  ];

  const parsedTime = moment(time.trim(), formats, true);

  if (!parsedTime.isValid()) {
    console.warn(`Invalid time format: ${time}`);
    return '00:00'; // Return default time if parsing fails
  }

  return parsedTime.format('HH:mm');
};

export const getAllDelivery = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      driverId,
      method,
      collectionTime,
      gteDeliveryDate,
      lteDeliveryDate,
      brand,
    } = req.query;

    // Build date query for collection time filtering
    if (gteDeliveryDate && lteDeliveryDate) {
      req.query.deliveryDate = {
        gte: new Date(gteDeliveryDate as string),
        lte: new Date(lteDeliveryDate as string),
      };
    } else if (gteDeliveryDate) {
      req.query.deliveryDate = { gte: new Date(gteDeliveryDate as string) };
    } else if (lteDeliveryDate) {
      req.query.deliveryDate = { lte: new Date(lteDeliveryDate as string) };
    }

    // Handle driverId filter
    if (driverId) {
      req.query['driverDetails.id'] = (driverId as string).split(',');
      delete req.query.driverId;
    }

    // Handle method filter
    if (method) {
      req.query.method = (method as string).split(',');
    }

    // Handle collection time filtering
    if (collectionTime) {
      // collectionTime can be:
      // 1. Array: ["9:00am-1:00pm", "3:00pm-6:30pm"]
      // 2. Comma-separated string: "9:00am-1:00pm,3:00pm-6:30pm"
      // 3. Single string: "9:00am-1:00pm"
      let timeRanges;
      if (Array.isArray(collectionTime)) {
        timeRanges = collectionTime;
      } else {
        // Split by comma and trim whitespace
        timeRanges = (collectionTime as string)
          .split(',')
          .map((range) => range.trim())
          .filter((range) => range.length > 0);
      }

      // Validate each time range format
      let parsedTimeRanges;
      try {
        parsedTimeRanges = timeRanges.map((timeRange) => {
          const [startTimeStr, endTimeStr] = (timeRange as string).split(
            /\s*-\s*/
          );
          if (!startTimeStr || !endTimeStr) {
            throw new Error('Invalid time format');
          }

          const startTime = convertTo24Hour(startTimeStr.trim());
          const endTime = convertTo24Hour(endTimeStr.trim());

          return {
            original: timeRange as string,
            startTime,
            endTime,
            startTimeStr: startTimeStr.trim(),
            endTimeStr: endTimeStr.trim(),
          };
        });
      } catch (error) {
        return next(
          new AppError(
            DELIVERY_COLLECTION_TIME.timeFormat,
            StatusCode.BAD_REQUEST
          )
        );
      }

      // Build date query for collection time filtering
      let dateQuery = {};
      if (gteDeliveryDate && lteDeliveryDate) {
        dateQuery = {
          deliveryDate: {
            $gte: new Date(gteDeliveryDate as string),
            $lte: new Date(lteDeliveryDate as string),
          },
        };
      } else if (gteDeliveryDate) {
        dateQuery = {
          deliveryDate: { $gte: new Date(gteDeliveryDate as string) },
        };
      } else if (lteDeliveryDate) {
        dateQuery = {
          deliveryDate: { $lte: new Date(lteDeliveryDate as string) },
        };
      }

      // Build the complete query including method filter
      const query = {
        ...dateQuery,
        brand,
      };

      // Add status filter - always exclude cancelled
      const requestedStatus = req.query.status;

      if (requestedStatus && requestedStatus !== CANCELLED) {
        // Frontend wants a specific status (and it's not cancelled)
        query.status = requestedStatus;
      } else if (requestedStatus === CANCELLED) {
        // Frontend specifically wants cancelled status, but we never show those
        // Set impossible condition to return empty results
        query.status = { $exists: false };
      } else {
        // No specific status requested, exclude cancelled
        query.status = { $ne: CANCELLED };
      }

      // Add method filter to the database query if provided
      if (method) {
        query.method = { $in: (method as string).split(',') };
      }

      // Add driverId filter to the database query if provided
      if (driverId) {
        query['driverDetails.id'] = { $in: (driverId as string).split(',') };
      }

      // Get all deliveries with basic filters
      const allDeliveries = await Delivery.find(query);

      // Filter by collection time with new logic
      const matchingDeliveryIds = new Set();

      // eslint-disable-next-line @typescript-eslint/no-shadow
      const filteredDeliveries = allDeliveries.filter(
        ({ collectionTime: orderCollectionTime, _id }) => {
          if (!orderCollectionTime) return false;
          if (matchingDeliveryIds.has(_id.toString())) return false; // Avoid duplicates

          try {
            // Parse the stored collection time
            const timeStr = orderCollectionTime.trim();
            const [storedStartStr, storedEndStr] = timeStr.split(/\s*-\s*/);

            if (!storedStartStr || !storedEndStr) return false;

            const storedStartTime = convertTo24Hour(storedStartStr.trim());
            const storedEndTime = convertTo24Hour(storedEndStr.trim());

            // Check against each requested time range
            const matchesAnyRange = parsedTimeRanges.some((timeRange) => {
              const { startTime, endTime, original } = timeRange;

              // Special case: if the requested range is exactly "9:00am-6:30pm", only show exact matches
              const normalizedOriginal = original
                .toLowerCase()
                .replace(/\s+/g, '');
              const isNineAmToSixThirtyPm =
                normalizedOriginal === '9:00am-6:30pm';

              if (isNineAmToSixThirtyPm) {
                const normalizedStored = timeStr
                  .toLowerCase()
                  .replace(/\s+/g, '');

                return normalizedOriginal === normalizedStored;
              }

              // Normal overlap logic for all other ranges
              // Special logic for ranges ending at 6:30pm (except 9am-6:30pm)
              if (endTime === '18:30') {
                // For 6:30pm ranges, show deliveries with end time > 4:00pm (16:00)
                const hasOverlap =
                  storedStartTime < endTime && storedEndTime > startTime;
                const endTimeAfterFourPm = storedEndTime > '16:00';

                return hasOverlap && endTimeAfterFourPm;
              }

              // Standard overlap logic for all other ranges
              // 1. Check if there's any intersection between time ranges
              // 2. Stored end time must be <= requested end time FOR THIS SPECIFIC RANGE
              const hasOverlap =
                storedStartTime < endTime && storedEndTime > startTime;
              const endTimeWithinLimit = storedEndTime <= endTime;

              // Both conditions must be true for this specific time range
              return hasOverlap && endTimeWithinLimit;
            });

            if (matchesAnyRange) {
              matchingDeliveryIds.add(_id.toString());
              return true;
            }

            return false;
          } catch (error) {
            console.warn(
              `Error parsing collection time in getAllDelivery: ${orderCollectionTime}`,
              error
            );
            return false;
          }
        }
      );

      // Return filtered results in the same format as getDeliveryWithCollectionTime
      return res.json({ success: true, data: filteredDeliveries });
    }

    // If no collection time filter, use standard getAll functionality
    // Add status filter - if frontend provides status, use it; otherwise exclude cancelled
    if (!req.query.status) {
      req.query.status = { $ne: CANCELLED }; // Only exclude cancelled when no status specified
    }

    // Remove collection time related params from query to avoid conflicts
    delete req.query.collectionTime;
    delete req.query.gteDeliveryDate;
    delete req.query.lteDeliveryDate;

    await getAll(Delivery)(req, res, next);
  }
);
export const getOneDelivery = getOne(Delivery);
export const deleteDelivery = deleteOne(Delivery, {
  action: ActivityActions.DELETE_DELIVERY,
  module: 'delivery',
});
export const updateDelivery = updateOne(Delivery, {
  action: ActivityActions.UPDATE_DELIVERY,
  module: 'delivery',
});
