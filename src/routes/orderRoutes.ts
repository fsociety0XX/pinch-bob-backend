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
  migrateOrders,
  placeOrder,
  removeRefImage,
  triggerOrderFailEmail,
  updateOrder,
  updateRefImages,
} from '@src/controllers/orderController';
import {
  BULK_ORDER,
  GET_WOO_ID,
  MIGRATE,
  PLACE_ORDER,
  TRIGGER_ORDER_FAIL_EMAIL,
  UPDATE_REF_IMG,
} from '@src/constants/routeConstants';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import { appendUserIdInReqQuery } from '@src/utils/middlewares';
import uploadImage from '@src/utils/uploadImage';

const orderRouter = express.Router();
orderRouter.get(GET_WOO_ID, getWoodeliveryId);
orderRouter.use(protect);
orderRouter.post(PLACE_ORDER, placeOrder);
orderRouter.get(TRIGGER_ORDER_FAIL_EMAIL, triggerOrderFailEmail);

orderRouter.route('/').get(appendUserIdInReqQuery, getAllOrder);
orderRouter
  .route('/:id')
  .get(authenticateOrderAccess, getOneOrder)
  .patch(authenticateOrderAccess, updateOrder);

orderRouter.use(roleRistriction(Role.ADMIN));
orderRouter.route('/').post(createOrder).patch(deleteManyOrder);
orderRouter.route(BULK_ORDER).post(bulkCreateOrders);
orderRouter
  .route(UPDATE_REF_IMG)
  .patch(
    authenticateOrderAccess,
    uploadImage(process.env.AWS_BUCKET_PRODUCT_PATH!).array(
      'additionalRefImages',
      10
    ),
    updateRefImages
  )
  .delete(authenticateOrderAccess, removeRefImage);

// MIGRATION API
orderRouter.route(MIGRATE).post(migrateOrders);

// Generic /:id routes should come last to avoid conflicts
orderRouter.route('/:id').delete(deleteOrder);

export default orderRouter;
