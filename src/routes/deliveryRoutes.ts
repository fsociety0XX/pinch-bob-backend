import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  ASSIGN_ORDER_TO_DRIVER,
  GET_DRIVERS,
  UPDATE_ORDER_STATUS,
} from '@src/constants/routeConstants';
import {
  assignOrderToDriver,
  deleteDelivery,
  getAllDelivery,
  getAllDrivers,
  getOneDelivery,
  updateDelivery,
  updateOrderStatus,
} from '@src/controllers/deliveryController';
import { appendCancelledStatusInReqQuery } from '@src/utils/middlewares';

const deliveryRouter = express.Router();
deliveryRouter.route(UPDATE_ORDER_STATUS).post(updateOrderStatus);

deliveryRouter.use(protect, roleRistriction(Role.ADMIN));
deliveryRouter.route(GET_DRIVERS).get(getAllDrivers);
deliveryRouter.route(ASSIGN_ORDER_TO_DRIVER).post(assignOrderToDriver);
deliveryRouter.route('/').get(appendCancelledStatusInReqQuery, getAllDelivery);
deliveryRouter
  .route('/:id')
  .get(getOneDelivery)
  .patch(updateDelivery)
  .delete(deleteDelivery);

export default deliveryRouter;
