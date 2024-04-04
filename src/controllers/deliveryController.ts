import { Request, Response } from 'express';
import {
  ASSIGN_TASK_TO_DRIVER,
  GET_WOODELIVERY_DRIVERS,
} from '@src/constants/routeConstants';
import { StatusCode } from '@src/types/customTypes';
import catchAsync from '@src/utils/catchAsync';
import { fetchAPI } from '@src/utils/functions';
import Delivery from '@src/models/deliveryModel';
import Order from '@src/models/orderModel';
import { WOODELIVERY_STATUS } from '@src/constants/static';

export const getAllDrivers = catchAsync(async (req: Request, res: Response) => {
  const response = await fetchAPI(GET_WOODELIVERY_DRIVERS, 'POST');
  const drivers = await response.json();
  res.status(StatusCode.SUCCESS).json({
    status: 'success',
    data: {
      data: drivers.data,
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

export const updateOrderStatus = catchAsync(
  async (req: Request, res: Response) => {
    const paramData = req.params.id;
    console.log(
      paramData,
      'paramData',
      paramData.split('-')[0],
      'taskTypeId',
      req.body.taskTypeId
    );
    const orderId = paramData.split('-')[0];
    await Delivery.findOneAndUpdate(
      { order: orderId },
      {
        status: WOODELIVERY_STATUS[req.body.taskTypeId],
      }
    );
    await Order.findByIdAndUpdate(orderId, {
      status: WOODELIVERY_STATUS[req.body.taskTypeId],
    });
    res.send(StatusCode.SUCCESS);
  }
);