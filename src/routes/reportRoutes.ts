import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  CUSTOMER_DELIVERY_REPORT,
  CUSTOMER_ORDER_REPORT,
} from '@src/constants/routeConstants';
import {
  fetchCustomerDataByDelivery,
  fetchCustomerDataByOrder,
} from '@src/controllers/reportController';

const reportRouter = express.Router();
reportRouter.use(protect, roleRistriction(Role.ADMIN));

reportRouter.route(CUSTOMER_ORDER_REPORT).get(fetchCustomerDataByOrder);
reportRouter.route(CUSTOMER_DELIVERY_REPORT).get(fetchCustomerDataByDelivery);

export default reportRouter;
