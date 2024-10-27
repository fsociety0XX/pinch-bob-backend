import express from 'express';
import {
  authenticateOrderAccess,
  createOrder,
  deleteManyOrder,
  deleteOrder,
  getAllOrder,
  getOneOrder,
  placeOrder,
  updateOrder,
} from '@src/controllers/orderController';
import { PLACE_ORDER } from '@src/constants/routeConstants';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import { appendUserIdInReqQuery } from '@src/utils/middlewares';

const orderRouter = express.Router();

orderRouter.use(protect);
orderRouter.post(PLACE_ORDER, placeOrder);

orderRouter.route('/').get(appendUserIdInReqQuery, getAllOrder);
orderRouter.route('/:id').get(authenticateOrderAccess, getOneOrder);

orderRouter.use(roleRistriction(Role.ADMIN));
orderRouter.route('/').post(createOrder);
orderRouter.route('/').patch(deleteManyOrder);
orderRouter.route('/:id').patch(updateOrder).delete(deleteOrder);

export default orderRouter;
