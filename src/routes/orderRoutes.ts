import express from 'express';
import { placeOrder } from '@src/controllers/orderController';
import { PLACE_ORDER } from '@src/constants/routeConstants';
import { protect } from '@src/controllers/authController';

const orderRouter = express.Router();

orderRouter.post(PLACE_ORDER, protect, placeOrder);

export default orderRouter;
