/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { NextFunction, Request, Response } from 'express';
import moment from 'moment';
import {
  ASSIGN_TASK_TO_DRIVER,
  GET_WOODELIVERY_DRIVERS,
  WOODELIVERY_TASK,
} from '@src/constants/routeConstants';
import { brandEnum, StatusCode } from '@src/types/customTypes';
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
          body = BOB_SMS_CONTENT.regularDelivered(order.user.firstName || '');
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

export const getDeliveryWithCollectionTime = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { collectionTime, gteDeliveryDate, lteDeliveryDate, brand } =
      req.query;

    if (!collectionTime) {
      return next(
        new AppError(
          DELIVERY_COLLECTION_TIME.collectionTime,
          StatusCode.BAD_REQUEST
        )
      );
    }

    const [startTimeStr, endTimeStr] = (collectionTime as string).split(
      /\s*-\s*/
    );
    if (!startTimeStr || !endTimeStr) {
      return next(
        new AppError(
          DELIVERY_COLLECTION_TIME.timeFormat,
          StatusCode.BAD_REQUEST
        )
      );
    }

    const startTime = convertTo24Hour(startTimeStr.trim());
    const endTime = convertTo24Hour(endTimeStr.trim());

    // Use the exact date range provided, don't convert to date-only
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

    const allDeliveries = await Delivery.find({
      ...dateQuery,
      brand,
    });

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const filteredDeliveries = allDeliveries.filter(({ collectionTime }) => {
      if (!collectionTime) return false;

      try {
        // Handle different formats with flexible splitting
        const timeStr = collectionTime.trim();
        const [storedStartStr, storedEndStr] = timeStr.split(/\s*-\s*/);

        if (!storedStartStr || !storedEndStr) return false;

        const storedStartTime = convertTo24Hour(storedStartStr.trim());
        const storedEndTime = convertTo24Hour(storedEndStr.trim());

        // Check if stored time range is completely within the requested range
        const isWithinRange =
          storedStartTime >= startTime && storedEndTime <= endTime;

        return isWithinRange;
      } catch (error) {
        console.warn(
          `Error parsing collection time in getDeliveryWithCollectionTime: ${collectionTime}`,
          error
        );
        return false;
      }
    });

    res.json({ success: true, data: filteredDeliveries });
  }
);

export const getAllDelivery = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { driverId, method } = req.query;
    if (driverId) {
      req.query['driverDetails.id'] = (driverId as string).split(',');
      delete req.query.driverId;
    }
    if (method) {
      req.query.method = (method as string).split(',');
    }

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
