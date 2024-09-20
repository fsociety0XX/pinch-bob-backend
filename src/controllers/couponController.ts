import { NextFunction, Response } from 'express';
import Coupon from '@src/models/couponModel';
import catchAsync from '@src/utils/catchAsync';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';
import { IRequestWithUser } from './authController';
import AppError from '@src/utils/appError';
import {
  StatusCode,
  couponApplicableEnum,
  couponTypeEnum,
} from '@src/types/customTypes';
import { COUPON_SCHEMA_VALIDATION } from '@src/constants/messages';

export const applyCoupon = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    const { code, ids, subTotal, totalProductQty } = req.body;
    const usedCoupons = req.user?.usedCoupons || [];
    const coupon = await Coupon.findOne({ code });

    // 1. check if coupon is valid and active
    if (
      !coupon?.id ||
      !coupon.active ||
      coupon.endDate <= new Date() ||
      coupon.startDate >= new Date()
    ) {
      return next(
        new AppError(COUPON_SCHEMA_VALIDATION.invalid, StatusCode.BAD_REQUEST)
      );
    }
    // 2. check if coupon is for 1 time use only
    if (
      coupon?.type === couponTypeEnum[1] &&
      usedCoupons?.includes(coupon.id)
    ) {
      return next(
        new AppError(
          COUPON_SCHEMA_VALIDATION.alreadyUsed,
          StatusCode.BAD_REQUEST
        )
      );
    }

    // 3. Check if coupon is applicable on specific product/category when coupon.applicableOn is !== 'All'
    if (coupon.applicableOn !== couponApplicableEnum[2]) {
      const hasSameElement = coupon?.ids?.some((element) =>
        ids.includes(element.toString())
      );
      if (!hasSameElement)
        return next(
          new AppError(
            COUPON_SCHEMA_VALIDATION.notForYourCart,
            StatusCode.BAD_REQUEST
          )
        );
    }

    // 4. check if limit still exist
    if (coupon?.limit && coupon?.limit === coupon?.used) {
      return next(
        new AppError(
          COUPON_SCHEMA_VALIDATION.notAvailable,
          StatusCode.BAD_REQUEST
        )
      );
    }

    // 5. check if subTotal is greater or equal to minPurchase value of coupon
    if (coupon?.minPurchase && +subTotal < coupon?.minPurchase) {
      return next(
        new AppError(
          COUPON_SCHEMA_VALIDATION.minPurchaseValue,
          StatusCode.BAD_REQUEST
        )
      );
    }

    // 6. check if total qty of products added in cart is gt/eq than coupon.minQty
    if (coupon?.minQty && +totalProductQty < coupon?.minQty) {
      return next(
        new AppError(COUPON_SCHEMA_VALIDATION.minQty, StatusCode.BAD_REQUEST)
      );
    }

    delete coupon.used; // hide this property from customers
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: coupon,
    });

    return false;
  }
);

export const createCoupon = createOne(Coupon);
export const updateCoupon = updateOne(Coupon);
export const deleteCoupon = deleteOne(Coupon);
export const getOneCoupon = getOne(Coupon);
export const getAllCoupon = getAll(Coupon);
