/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { NextFunction, Request, Response } from 'express';
import { Document } from 'mongoose';
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

interface SortQuery {
  [key: string]: number;
}

/**
 * Enhanced sorting function for delivery queries with support for nested field sorting
 * Supports: orderNumber, deliveryDate, collectionTime, address (maps to address.address1), and postalCode (maps to address.postalCode)
 */
const buildDeliverySortQuery = (sortParam?: string): SortQuery => {
  if (!sortParam) return {};

  // Support 2 common frontend formats:
  // 1) 'field,direction' e.g. 'postalCode,desc'
  // 2) '-field' e.g. '-postalCode' (minus indicates desc)
  let field = sortParam;
  let direction: string | undefined;

  if (sortParam.includes(',')) {
    const parts = sortParam.split(',');
    [field, direction] = parts;
  }

  // If field uses '-field' shorthand, treat as desc and strip the -
  let sortOrder = 1;
  if (field.startsWith('-')) {
    sortOrder = -1;
    field = field.slice(1);
  } else if (direction === 'desc') {
    sortOrder = -1;
  }

  // Map logical fields to actual DB fields (supports populated nested address fields)
  if (field === 'address') {
    return { 'address.address1': sortOrder };
  }

  if (field === 'postalCode') {
    return { 'address.postalCode': sortOrder };
  }

  // Direct fields on Delivery
  const allowedFields = ['orderNumber', 'deliveryDate', 'collectionTime'];
  if (allowedFields.includes(field)) {
    return { [field]: sortOrder };
  }

  return {};
};

/**
 * Custom delivery retrieval with enhanced sorting capabilities
 */
const getDeliveriesWithCustomSort = async (
  query: DeliveryQuery,
  sortParam?: string,
  page = 1,
  limit = 10
): Promise<{
  data: Document[];
  totalCount: number;
  currentPage: number;
}> => {
  const sortQuery = buildDeliverySortQuery(sortParam);
  const skip = (page - 1) * limit;

  // Get total count for pagination
  const totalCount = await Delivery.countDocuments(query);

  // If sorting targets a populated (referenced) nested field like 'address.postalCode'
  // MongoDB cannot sort by fields on a referenced document with a simple .sort on the Delivery collection.
  // Fallback to fetching, populating, then sorting in-memory so asc/desc behave correctly.
  const sortKeys = Object.keys(sortQuery);
  const isPopulatedFieldSort = sortKeys.some((k) => k.startsWith('address.'));

  if (isPopulatedFieldSort) {
    // Fetch all matching docs (no skip/limit) then sort in JS and paginate the result
    const allDeliveries = await Delivery.find(query).populate('address').exec();

    const getNestedValue = (obj: unknown, path: string): unknown =>
      path.split('.').reduce((o: unknown, p: string) => {
        if (o && typeof o === 'object') {
          return (o as Record<string, unknown>)[p];
        }
        return undefined;
      }, obj);

    const sortKey = sortKeys[0];
    const sortDirection = sortQuery[sortKey] === -1 ? -1 : 1;

    allDeliveries.sort((a: Document, b: Document) => {
      const va = getNestedValue(a as unknown, sortKey);
      const vb = getNestedValue(b as unknown, sortKey);

      // Normalize null/undefined
      if (va == null && vb == null) return 0;
      if (va == null) return -1 * sortDirection;
      if (vb == null) return 1 * sortDirection;

      const normalize = (v: unknown) => {
        if (typeof v === 'string') return v.trim().toUpperCase();
        if (typeof v === 'number') return v;
        return String(v ?? '')
          .trim()
          .toUpperCase();
      };

      const na = normalize(va);
      const nb = normalize(vb);

      // If both normalized values are numeric (postal codes like '01234' or '12345'), compare numerically
      const toNumber = (x: unknown) => {
        if (typeof x === 'number') return x as number;
        const s = String(x).replace(/[^0-9.-]+/g, '');
        const n = s === '' ? NaN : Number(s);
        return Number.isFinite(n) ? n : NaN;
      };

      const naNum = toNumber(na);
      const nbNum = toNumber(nb);

      if (!Number.isNaN(naNum) && !Number.isNaN(nbNum)) {
        if (naNum < nbNum) return -1 * sortDirection;
        if (naNum > nbNum) return 1 * sortDirection;
        return 0;
      }

      // Lexicographic compare
      if (na < nb) return -1 * sortDirection;
      if (na > nb) return 1 * sortDirection;

      // Tie-breaker: use orderNumber, then _id to ensure deterministic ordering
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oa = (a as any).orderNumber || String((a as Document)._id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ob = (b as any).orderNumber || String((b as Document)._id);
      if (oa && ob && oa !== ob) {
        return (
          oa.localeCompare(ob, undefined, {
            sensitivity: 'base',
            numeric: true,
          }) * sortDirection
        );
      }

      const ida = String((a as Document)._id);
      const idb = String((b as Document)._id);
      if (ida < idb) return -1 * sortDirection;
      if (ida > idb) return 1 * sortDirection;
      return 0;
    });

    const paginated = allDeliveries.slice(skip, skip + limit);

    return {
      data: paginated,
      totalCount: allDeliveries.length,
      currentPage: page,
    };
  }

  // Execute query with sorting and pagination (database-side sort for non-populated fields)
  const data = await Delivery.find(query)
    .populate('address')
    .sort(sortQuery)
    .skip(skip)
    .limit(limit)
    .exec();

  return {
    data,
    totalCount,
    currentPage: page,
  };
};

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

    await Order.findOneAndUpdate(
      { orderNumber: doc?.orderNumber },
      {
        driverDetails: {
          id: driverDetails.id,
          name: `${driverDetails.firstName} ${driverDetails.lastName}`,
        },
      },
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

    await Order.findOneAndUpdate(
      { orderNumber: doc?.orderNumber },
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
          { orderNumber, brand },
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

  // Add driverId filter
  if (req.query['driverDetails.id']) {
    query['driverDetails.id'] = req.query['driverDetails.id'];
  }

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
      sort,
      page = '1',
      limit = '10',
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

        // Apply pagination if requested
        const pageNum = parseInt(page as string, 10) || 1;
        const limitNum = parseInt(limit as string, 10) || 10;
        const skip = (pageNum - 1) * limitNum;

        const paginatedData = filteredDeliveries.slice(skip, skip + limitNum);
        const totalCount = filteredDeliveries.length;

        // Return filtered and paginated results with metadata
        return res.status(StatusCode.SUCCESS).json({
          status: 'success',
          data: {
            data: paginatedData,
          },
          meta: {
            totalDataCount: totalCount,
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
          },
        });
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

    // Check if custom sorting is requested for delivery-specific fields
    const customSortFields = [
      'orderNumber',
      'deliveryDate',
      'collectionTime',
      'address',
      'postalCode',
    ];

    const hasCustomSort =
      sort &&
      customSortFields.some((field) => {
        const sortStr = sort as string;
        // Extract the field name from sort parameter (format: "field,direction" or "-field")
        const [sortField] = sortStr.split(',');
        const cleanSortField = sortField.startsWith('-')
          ? sortField.slice(1)
          : sortField;
        // Exact match only to prevent false positives like "userAddress" matching "address"
        return cleanSortField === field;
      });

    if (hasCustomSort) {
      // Use custom sorting for delivery-specific fields
      try {
        // Build base query
        const baseQuery: DeliveryQuery = {};

        // Add brand filter if provided
        if (req.query.brand) {
          baseQuery.brand = req.query.brand;
        }

        // Add status filter - if frontend provides status, use it; otherwise exclude cancelled
        if (!req.query.status) {
          baseQuery.status = { $ne: CANCELLED };
        } else {
          baseQuery.status = req.query.status;
        }

        // Always filter out deliveries with paid: false
        baseQuery.paid = true;

        // Add delivery date filter
        if (req.query.deliveryDate) {
          const dateFilter = req.query.deliveryDate;
          if (typeof dateFilter === 'object' && dateFilter !== null) {
            // Convert gte/lte to MongoDB $gte/$lte format
            const mongoDateFilter: { $gte?: Date; $lte?: Date } = {};
            if ('gte' in dateFilter) {
              mongoDateFilter.$gte = dateFilter.gte as Date;
            }
            if ('lte' in dateFilter) {
              mongoDateFilter.$lte = dateFilter.lte as Date;
            }
            baseQuery.deliveryDate = mongoDateFilter;
          } else {
            baseQuery.deliveryDate = dateFilter;
          }
        }

        // Add driverId filter
        if (req.query['driverDetails.id']) {
          baseQuery['driverDetails.id'] = req.query['driverDetails.id'];
        }

        // Add method filter
        if (req.query.method) {
          baseQuery.method = req.query.method;
        }

        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);

        // Use custom sorting function
        const result = await getDeliveriesWithCustomSort(
          baseQuery,
          sort as string,
          pageNum,
          limitNum
        );

        return res.status(StatusCode.SUCCESS).json({
          status: 'success',
          data: {
            data: result.data,
          },
          meta: {
            totalDataCount: result.totalCount,
            currentPage: result.currentPage,
          },
        });
      } catch (error) {
        console.error('❌ Error in custom delivery sorting:', error);
        return next(
          new AppError(
            'Error occurred while sorting deliveries',
            StatusCode.INTERNAL_SERVER_ERROR
          )
        );
      }
    }

    // If no custom sorting needed, use standard getAll functionality
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
