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
import {
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

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

export const updateOrderStatus = catchAsync(
  async (req: Request, res: Response) => {
    const orderNumber = req.params.id;
    const { brand } = req.query;

    if (brand === 'pinch') {
      const order = await Order.findOne({ orderNumber });
      await Delivery.findOneAndUpdate(
        { order: order?._id },
        {
          status: WOODELIVERY_STATUS[req.body.StatusId],
        }
      );
      await Order.findByIdAndUpdate(order?._id, {
        status: WOODELIVERY_STATUS[req.body.StatusId],
      });
    }
    res.send(StatusCode.SUCCESS);
  }
);

export const getAllDelivery = getAll(Delivery, ['driverId']);
export const getOneDelivery = getOne(Delivery);
export const deleteDelivery = deleteOne(Delivery);
export const updateDelivery = updateOne(Delivery);
