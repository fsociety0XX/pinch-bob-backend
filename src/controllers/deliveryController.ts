import { NextFunction, Request, Response } from 'express';
import {
  ASSIGN_TASK_TO_DRIVER,
  GET_WOODELIVERY_DRIVERS,
  WOODELIVERY_TASK,
} from '@src/constants/routeConstants';
import { StatusCode } from '@src/types/customTypes';
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
import { PINCH_EMAILS } from '@src/constants/messages';

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
  async (req: Request, res: Response) => {
    const deliveryId = req.params.id;
    const { driverDetails, woodeliveryTaskId } = req.body;
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

    const doc = await Delivery.findByIdAndUpdate(
      deliveryId,
      { driverDetails: null },
      { new: true }
    );

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
      });
    }
    res.send(StatusCode.SUCCESS);
  }
);

export const getAllDelivery = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.query.driverId) {
      req.query['driverDetails.id'] = (req.query.driverId as string).split(',');
      delete req.query.driverId;
    }
    await getAll(Delivery)(req, res, next);
  }
);
export const getOneDelivery = getOne(Delivery);
export const deleteDelivery = deleteOne(Delivery);
export const updateDelivery = updateOne(Delivery);
