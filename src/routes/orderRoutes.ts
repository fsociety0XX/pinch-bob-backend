import express from 'express';
import {
  placeOrder,
  triggerOrderFailEmail,
} from '@src/controllers/orderController';
import {
  PLACE_ORDER,
  TRIGGER_ORDER_FAIL_EMAIL,
} from '@src/constants/routeConstants';
import { protect } from '@src/controllers/authController';

const orderRouter = express.Router();

orderRouter.post(PLACE_ORDER, protect, placeOrder);
orderRouter.get(TRIGGER_ORDER_FAIL_EMAIL, protect, triggerOrderFailEmail);

export default orderRouter;
