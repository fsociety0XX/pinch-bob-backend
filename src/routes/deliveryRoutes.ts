import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  ASSIGN_ORDER_TO_DRIVER,
  GET_DELIVERY_WITH_COLLECTION_TIME,
  GET_DRIVERS,
  UNASSIGN_ORDER_TO_DRIVER,
  UPDATE_ORDER_STATUS,
} from '@src/constants/routeConstants';
import {
  assignOrderToDriver,
  deleteDelivery,
  getAllDelivery,
  getAllDrivers,
  getDeliveryWithCollectionTime,
  getOneDelivery,
  unassignDriver,
  updateDelivery,
  updateOrderStatus,
} from '@src/controllers/deliveryController';

const deliveryRouter = express.Router();
deliveryRouter.route(UPDATE_ORDER_STATUS).post(updateOrderStatus);

deliveryRouter.use(protect, roleRistriction(Role.ADMIN));
deliveryRouter.route(GET_DRIVERS).get(getAllDrivers);
deliveryRouter.route(ASSIGN_ORDER_TO_DRIVER).post(assignOrderToDriver);
deliveryRouter.route(UNASSIGN_ORDER_TO_DRIVER).patch(unassignDriver);
deliveryRouter.route('/').get(getAllDelivery);
deliveryRouter
  .route(GET_DELIVERY_WITH_COLLECTION_TIME)
  .get(getDeliveryWithCollectionTime);
deliveryRouter
  .route('/:id')
  .get(getOneDelivery)
  .patch(updateDelivery)
  .delete(deleteDelivery);

export default deliveryRouter;
