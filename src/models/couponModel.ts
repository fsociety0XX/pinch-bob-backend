import mongoose from 'mongoose';
import {
  COMMON_SCHEMA_VALIDATION,
  COUPON_SCHEMA_VALIDATION,
} from '@src/constants/messages';
import {
  brandEnum,
  couponApplicableEnum,
  couponTypeEnum,
} from '@src/types/customTypes';

interface ICoupon {
  brand: string;
  code: string;
  type: string;
  applicableOn: string;
  ids?: [mongoose.Schema.Types.ObjectId];
  limit: number; // how many times coupon can be used overall
  startDate: Date;
  endDate: Date;
  discountType: string;
  discount: number;
  minPurchase: number;
  minQty: number;
  used?: number;
  active: boolean;
}

const couponSchema = new mongoose.Schema<ICoupon>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    code: {
      type: String,
      required: [true, COUPON_SCHEMA_VALIDATION.code],
      trim: true,
    },
    type: {
      type: String,
      required: [true, COUPON_SCHEMA_VALIDATION.type],
      enum: couponTypeEnum,
    },
    applicableOn: {
      type: String,
      required: [true, COUPON_SCHEMA_VALIDATION.applicableOn],
      enum: couponApplicableEnum,
    },
    ids: [mongoose.Schema.ObjectId],
    limit: Number,
    startDate: Date,
    endDate: Date,
    minPurchase: Number,
    minQty: Number, // If we need a coupon with conditions like "Buy 2 Get 10% Off"
    discountType: {
      type: String,
      required: [true, COUPON_SCHEMA_VALIDATION.discountType],
      enum: ['Percentage', 'Amount'],
    },
    discount: {
      type: Number,
      required: [true, COUPON_SCHEMA_VALIDATION.discount],
    },
    used: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

couponSchema.index({ code: 1, brand: 1 }, { unique: true });

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
