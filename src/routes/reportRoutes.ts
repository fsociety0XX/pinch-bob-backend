import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  AGGREGATE_REPORT,
  CUSTOMER_DELIVERY_REPORT,
  CUSTOMER_ORDER_REPORT,
} from '@src/constants/routeConstants';
import {
  aggregatedCustomerReport,
  fetchCustomerDataByDelivery,
  fetchCustomerDataByOrder,
} from '@src/controllers/reportController';

const reportRouter = express.Router();
reportRouter.use(protect, roleRistriction(Role.ADMIN));

reportRouter.route(CUSTOMER_ORDER_REPORT).get(fetchCustomerDataByOrder);
reportRouter.route(CUSTOMER_DELIVERY_REPORT).get(fetchCustomerDataByDelivery);
reportRouter.route(AGGREGATE_REPORT).get(aggregatedCustomerReport);

export default reportRouter;
