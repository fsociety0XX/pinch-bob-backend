import Stripe from 'stripe';
import mongoose, { model } from 'mongoose';
import {
  COMMON_SCHEMA_VALIDATION,
  ORDER_SCHEMA_VALIDATION,
} from '@src/constants/messages';
import { brandEnum, deliveryTypeEnum } from '@src/types/customTypes';

type StripeWebhookEvent = Stripe.Event;

interface IPhoto {
  key: string;
  originalname: string;
  mimetype: string;
  size: number;
  location: string;
}

interface IRecipInfo {
  sameAsSender: boolean;
  name: string;
  contact: number;
}

interface IPricingSummary {
  subTotal: string;
  gst: string;
  deliveryCharge: string;
  coupon: mongoose.Schema.Types.ObjectId;
  total: string;
}

interface IDelivery {
  date: string;
  method: mongoose.Schema.Types.ObjectId;
  collectionTime: mongoose.Schema.Types.ObjectId;
  address: mongoose.Schema.Types.ObjectId;
}

export interface IProduct {
  product: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
    images: IPhoto[];
  };
  price: number;
  quantity?: number;
  size?: mongoose.Schema.Types.ObjectId;
  pieces?: mongoose.Schema.Types.ObjectId;
  flavour?: mongoose.Schema.Types.ObjectId;
  refImage?: IPhoto;
  msg?: string;
  fondantInfo?: string;
  address?: string; // will be used if delivery type - multi location delivery
}

interface IOrderSchema {
  brand: string;
  deliveryType: string; // multi or single location delivery
  product: IProduct[];
  user: mongoose.Schema.Types.ObjectId;
  delivery: IDelivery;
  pricingSummary: IPricingSummary;
  recipInfo?: IRecipInfo;
  paid: boolean;
  orderStatus: string;
  stripeDetails: StripeWebhookEvent;
  active: boolean;
}

const ProductImageSchema = new mongoose.Schema<IPhoto>({
  key: String,
  originalname: String,
  mimetype: String,
  size: Number,
  location: String,
});

const ProductSchema = new mongoose.Schema<IProduct>({
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
  },
  price: Number,
  quantity: Number,
  size: {
    type: mongoose.Schema.ObjectId,
    ref: 'Size',
  },
  pieces: {
    type: mongoose.Schema.ObjectId,
    ref: 'Pieces',
  },
  flavour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Flavour',
  },
  refImage: ProductImageSchema,
  msg: String,
  fondantInfo: String,
  address: String,
});

const DeliverySchema = new mongoose.Schema<IDelivery>({
  date: String,
  method: mongoose.Schema.ObjectId,
  collectionTime: mongoose.Schema.ObjectId,
  address: mongoose.Schema.ObjectId,
});

const PricingSummarySchema = new mongoose.Schema<IPricingSummary>({
  subTotal: String,
  gst: String,
  deliveryCharge: String,
  coupon: mongoose.Schema.ObjectId,
  total: String,
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const orderSchema = new mongoose.Schema<IOrderSchema>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    deliveryType: {
      type: String,
      default: 'single',
      enum: deliveryTypeEnum,
    },
    product: [
      {
        type: ProductSchema,
        required: [true, ORDER_SCHEMA_VALIDATION.product],
      },
    ],
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    delivery: {
      type: DeliverySchema,
      required: [true, ORDER_SCHEMA_VALIDATION.delivery],
    },
    pricingSummary: {
      type: PricingSummarySchema,
      required: [true, ORDER_SCHEMA_VALIDATION.pricingSummary],
    },
    recipInfo: {
      sameAsSender: Boolean,
      name: String,
      contact: Number,
    },
    paid: {
      type: Boolean,
      required: [true, ORDER_SCHEMA_VALIDATION.paid],
      default: false,
    },
    orderStatus: String,
    stripeDetails: Object,
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

orderSchema.pre('findOne', function (next) {
  this.populate({
    path: 'product.product',
    select: 'name images',
  });
  this.find({ active: { $eq: true } });
  next();
});

const Order = model<IOrderSchema>('Order', orderSchema);

export default Order;
