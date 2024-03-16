import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  createDeliveryMethod,
  deleteDeliveryMethod,
  getAllDeliveryMethod,
  getOneDeliveryMethod,
  updateDeliveryMethod,
} from '@src/controllers/deliveryMethodController';

const deliveryMethodRouter = express.Router();

deliveryMethodRouter.route('/').get(getAllDeliveryMethod);

deliveryMethodRouter.use(protect, roleRistriction(Role.ADMIN));
deliveryMethodRouter.route('/').post(createDeliveryMethod);

deliveryMethodRouter
  .route('/:id')
  .get(getOneDeliveryMethod)
  .patch(updateDeliveryMethod)
  .delete(deleteDeliveryMethod);

export default deliveryMethodRouter;