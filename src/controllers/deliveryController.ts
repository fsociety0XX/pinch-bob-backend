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

interface DeliveryQuery {
  deliveryDate?: {
    $gte?: Date;
    $lte?: Date;
  };
  brand?: string;
  status?: string | { $ne: string } | { $exists: boolean };
  method?: { $in: string[] };
  'driverDetails.id'?: { $in: string[] };
  paid?: boolean | { $ne: boolean };
}

interface ParsedTimeRange {
  original: string;
  startTime: string;
  endTime: string;
  startTimeStr: string;
  endTimeStr: string;
}

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
    try {
      const orderNumber = req.params.id;
      const { brand } = req.query;

      // Validate required webhook data
      if (!orderNumber) {
        console.error('❌ No order number provided in webhook');
        return res.status(StatusCode.SUCCESS).json({
          status: 'error',
          message: 'No order number provided',
        });
      }

      if (!brand) {
        console.error('❌ No brand provided in webhook');
        return res.status(StatusCode.SUCCESS).json({
          status: 'error',
          message: 'No brand provided',
        });
      }

      if (!req.body.StatusId) {
        console.error('❌ No StatusId provided in webhook');
        return res.status(StatusCode.SUCCESS).json({
          status: 'error',
          message: 'No StatusId provided',
        });
      }

      // Find the order
      const order = await Order.findOne({ orderNumber, brand }).populate([
        'user',
        'delivery.address',
        'recipInfo',
      ]);

      if (!order) {
        return res.status(StatusCode.SUCCESS).json({
          status: 'not found',
          message: `No order found with order number: ${orderNumber} for ${brand}`,
        });
      }

      // Get the new status
      const newStatus = WOODELIVERY_STATUS[req.body.StatusId];
      if (!newStatus) {
        console.error('❌ Invalid StatusId:', req.body.StatusId);
        return res.status(StatusCode.SUCCESS).json({
          status: 'error',
          message: `Invalid StatusId: ${req.body.StatusId}`,
        });
      }

      // Update delivery status (handle case where delivery might not exist)
      try {
        await Delivery.findOneAndUpdate(
          { order: order._id },
          { status: newStatus },
          { new: true }
        );
      } catch (deliveryError) {
        console.error('❌ Error updating delivery status:', deliveryError);
        // Continue execution - don't fail webhook for delivery update issues
      }

      // Update order status
      try {
        await Order.findByIdAndUpdate(order._id, { status: newStatus });
      } catch (orderError) {
        console.error('❌ Error updating order status:', orderError);
        // Continue execution - don't fail webhook for order update issues
      }

      // Handle completion notifications
      if (newStatus === 'Completed') {
        try {
          // Send SMS for Bob brand
          if (brand === brandEnum[1]) {
            // Bob

            let smsBody = '';
            try {
              if (order.corporate) {
                smsBody = BOB_SMS_CONTENT.corporateDelivered;
              } else {
                const recipientName =
                  order.recipInfo?.name || order.user?.firstName || 'Customer';
                smsBody = BOB_SMS_CONTENT.regularDelivered(recipientName);
              }

              // Get phone number with multiple fallbacks
              const phone =
                order.recipInfo?.contact ||
                order.delivery?.address?.phone ||
                order.user?.phone;

              if (phone && String(phone).trim()) {
                await sendSms(smsBody, String(phone).trim());
              }
            } catch (smsError) {
              console.error('❌ SMS sending failed:', smsError);
              // Continue - don't fail webhook for SMS issues
            }
          }

          // Send email for both brands
          try {
            const userEmail = order.user?.email;
            if (userEmail && userEmail.trim()) {
              // Get brand-specific email template
              let emailConfig;
              if (brand === brandEnum[0]) {
                // Pinch
                emailConfig = PINCH_EMAILS.reqForReview;
              } else {
                // Bob - use similar template structure
                emailConfig = {
                  subject: 'Your order has been delivered!',
                  template: 'orderDeliverAndReview',
                  previewText: 'Your order has been delivered!',
                };
              }

              const { subject, template, previewText } = emailConfig;

              await sendEmail({
                email: userEmail.trim(),
                subject,
                template,
                context: {
                  previewText,
                  orderNo: order.orderNumber || orderNumber,
                  customerName:
                    `${order.user?.firstName || ''} ${
                      order.user?.lastName || ''
                    }`.trim() || 'Customer',
                },
                brand: brand as string,
              });
            }
          } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
            // Continue - don't fail webhook for email issues
          }
        } catch (notificationError) {
          console.error(
            '❌ Notification processing failed:',
            notificationError
          );
          // Continue - notifications are not critical for webhook success
        }
      }

      // Always return success to woodelivery
      res.status(StatusCode.SUCCESS).json({
        status: 'success',
        message: 'Order status updated successfully',
        orderNumber,
        newStatus,
        brand,
      });
    } catch (error) {
      console.error('💥 Critical error in updateOrderStatus webhook:', {
        error: error.message,
        stack: error.stack,
        orderNumber: req.params.id,
        brand: req.query.brand,
        statusId: req.body.StatusId,
      });

      // Always return 200 to prevent woodelivery from marking webhook as failed
      res.status(StatusCode.SUCCESS).json({
        status: 'error',
        message: 'Error processing webhook',
        error: error.message,
        orderNumber: req.params.id,
        brand: req.query.brand,
      });
    }
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
    console.warn(`❌ Invalid time format: ${time}`);
    return '00:00'; // Return default time if parsing fails
  }

  return parsedTime.format('HH:mm');
};

const parseCollectionTimeRanges = (collectionTime: string | string[]) => {
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

  // Validate and parse each time range
  return timeRanges.map((timeRange) => {
    const [startTimeStr, endTimeStr] = (timeRange as string).split(/\s*-\s*/);
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
};

const checkTimeRangeMatch = (
  orderCollectionTime: string,
  parsedTimeRanges: ParsedTimeRange[]
) => {
  if (!orderCollectionTime) return false;

  try {
    // Parse the stored collection time
    const timeStr = orderCollectionTime.trim();
    const [storedStartStr, storedEndStr] = timeStr.split(/\s*-\s*/);

    if (!storedStartStr || !storedEndStr) return false;

    const storedStartTime = convertTo24Hour(storedStartStr.trim());
    const storedEndTime = convertTo24Hour(storedEndStr.trim());

    // Check against each requested time range
    return parsedTimeRanges.some((timeRange) => {
      const { startTime, endTime, original } = timeRange;

      // Special case: if the requested range is exactly "9:00am-6:30pm", only show exact matches
      const normalizedOriginal = original.toLowerCase().replace(/\s+/g, '');
      const isNineAmToSixThirtyPm = normalizedOriginal === '9:00am-6:30pm';

      if (isNineAmToSixThirtyPm) {
        const normalizedStored = timeStr.toLowerCase().replace(/\s+/g, '');
        const exactMatch = normalizedOriginal === normalizedStored;
        return exactMatch;
      }

      // For all other ranges (including other 6:30pm ranges), use standard completely-within logic
      // This ensures that 9am-6:30pm orders only show when specifically selecting 9am-6:30pm
      const isCompletelyWithin =
        storedStartTime >= startTime && storedEndTime <= endTime;

      return isCompletelyWithin;
    });
  } catch (error) {
    console.warn(
      `Error parsing collection time in checkTimeRangeMatch: ${orderCollectionTime}`,
      error
    );
    return false;
  }
};

const filterDeliveriesByCollectionTime = async (
  query: DeliveryQuery,
  collectionTime: string | string[]
) => {
  // Parse and validate time ranges
  const parsedTimeRanges = parseCollectionTimeRanges(collectionTime);

  // Get all deliveries with basic filters
  const allDeliveries = await Delivery.find(query);

  // Filter by collection time with optimized logic
  const matchingDeliveryIds = new Set();

  const filteredDeliveries = allDeliveries.filter(
    ({ collectionTime: orderCollectionTime, _id }) => {
      if (matchingDeliveryIds.has(_id.toString())) return false; // Avoid duplicates

      const matches = checkTimeRangeMatch(
        orderCollectionTime,
        parsedTimeRanges
      );

      if (matches) {
        matchingDeliveryIds.add(_id.toString());
        return true;
      }

      return false;
    }
  );

  return filteredDeliveries;
};

const buildDeliveryQuery = (req: Request): DeliveryQuery => {
  const {
    driverId,
    method,
    gteDeliveryDate,
    lteDeliveryDate,
    brand,
    status: requestedStatus,
  } = req.query;

  // Build date query
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

  // Build the complete query
  const query = {
    ...dateQuery,
    brand,
    paid: true, // Only show deliveries where paid: true
  };

  // Add status filter - always exclude cancelled unless specifically requested
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

  // Add method filter
  if (method) {
    // Handle both string and array cases
    if (Array.isArray(method)) {
      query.method = { $in: method };
    } else {
      query.method = { $in: (method as string).split(',') };
    }
  }

  // Add driverId filter
  if (driverId) {
    // Handle both string and array cases
    if (Array.isArray(driverId)) {
      query['driverDetails.id'] = { $in: driverId };
    } else {
      query['driverDetails.id'] = { $in: (driverId as string).split(',') };
    }
  }

  return query;
};

export const getAllDelivery = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      driverId,
      method,
      collectionTime,
      gteDeliveryDate,
      lteDeliveryDate,
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
      try {
        // Build query using helper function
        const query = buildDeliveryQuery(req);

        // Filter deliveries by collection time using helper function
        const filteredDeliveries = await filterDeliveriesByCollectionTime(
          query,
          collectionTime
        );

        // Return filtered results
        return res.json({ success: true, data: filteredDeliveries });
      } catch (error) {
        console.error('❌ Error in collection time filtering:', error);
        return next(
          new AppError(
            DELIVERY_COLLECTION_TIME.timeFormat,
            StatusCode.BAD_REQUEST
          )
        );
      }
    }

    // If no collection time filter, use standard getAll functionality
    // Add status filter - if frontend provides status, use it; otherwise exclude cancelled
    if (!req.query.status) {
      req.query.status = { $ne: CANCELLED };
    }

    // Always filter out deliveries with paid: false
    req.query.paid = true;

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
