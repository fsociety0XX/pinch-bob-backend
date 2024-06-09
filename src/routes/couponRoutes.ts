import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  applyCoupon,
  createCoupon,
  deleteCoupon,
  getAllCoupon,
  getOneCoupon,
  updateCoupon,
} from '@src/controllers/couponController';

const couponRouter = express.Router();

couponRouter.route('/apply').post(applyCoupon);
couponRouter.use(protect, roleRistriction(Role.ADMIN));
couponRouter.route('/').get(getAllCoupon);
couponRouter.route('/').post(createCoupon);

couponRouter
  .route('/:id')
  .get(getOneCoupon)
  .patch(updateCoupon)
  .delete(deleteCoupon);

export default couponRouter;
