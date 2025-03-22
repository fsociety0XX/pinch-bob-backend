import express from 'express';
import {
  authenticateOrderAccess,
  bulkCreateOrders,
  createOrder,
  deleteManyOrder,
  deleteOrder,
  getAllOrder,
  getOneOrder,
  getWoodeliveryId,
  placeOrder,
  triggerOrderFailEmail,
  updateOrder,
} from '@src/controllers/orderController';
import {
  BULK_ORDER,
  GET_WOO_ID,
  PLACE_ORDER,
  TRIGGER_ORDER_FAIL_EMAIL,
} from '@src/constants/routeConstants';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import { appendUserIdInReqQuery } from '@src/utils/middlewares';

const orderRouter = express.Router();
orderRouter.get(GET_WOO_ID, getWoodeliveryId);
orderRouter.use(protect);
orderRouter.post(PLACE_ORDER, placeOrder);
orderRouter.get(TRIGGER_ORDER_FAIL_EMAIL, triggerOrderFailEmail);

orderRouter.route('/').get(appendUserIdInReqQuery, getAllOrder);
orderRouter.route('/:id').get(authenticateOrderAccess, getOneOrder);

orderRouter.use(roleRistriction(Role.ADMIN));
orderRouter.route('/').post(createOrder);
orderRouter.route(BULK_ORDER).post(bulkCreateOrders);
orderRouter.route('/').patch(deleteManyOrder);
orderRouter.route('/:id').patch(updateOrder).delete(deleteOrder);

export default orderRouter;
