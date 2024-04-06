import Stripe from 'stripe';
import mongoose, { Query, model } from 'mongoose';
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
  method: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
  };
  collectionTime: string;
  address: {
    id: mongoose.Schema.Types.ObjectId;
    firstName: string;
    lastName: string;
    city: string;
    country: string;
    company?: string;
    address1: string;
    address2?: string;
    postalCode: string;
    phone: number;
  };
}

export interface IProduct {
  product: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
    images: IPhoto[];
  };
  price: number;
  quantity?: number;
  size?: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
  };
  pieces?: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
  };
  flavour?: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
  };
  colour?: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
  };
  refImage?: IPhoto;
  msg?: string;
  fondantInfo?: string;
  address?: string; // will be used if delivery type - multi location delivery
}

export interface IOrder {
  id: string;
  brand: string;
  deliveryType: string; // multi or single location delivery
  product: IProduct[];
  user: mongoose.Types.ObjectId;
  delivery: IDelivery;
  pricingSummary: IPricingSummary;
  recipInfo?: IRecipInfo;
  paid: boolean;
  status: string;
  stripeDetails: StripeWebhookEvent;
  woodeliveryTaskId: string;
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
  colour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Colour',
  },
  refImage: ProductImageSchema,
  msg: String,
  fondantInfo: String,
  address: String,
});

const DeliverySchema = new mongoose.Schema<IDelivery>({
  date: String,
  method: {
    type: mongoose.Schema.ObjectId,
    ref: 'DeliveryMethod',
  },
  collectionTime: String,
  address: {
    type: mongoose.Schema.ObjectId,
    ref: 'Address',
  },
});

const PricingSummarySchema = new mongoose.Schema<IPricingSummary>({
  subTotal: String,
  gst: String,
  deliveryCharge: String,
  coupon: mongoose.Schema.ObjectId,
  total: String,
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const orderSchema = new mongoose.Schema<IOrder>(
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
    status: String,
    stripeDetails: Object,
    woodeliveryTaskId: String,
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
    path: 'product.product product.size product.colour product.pieces product.flavour delivery.method',
    select: 'name images',
  });
  this.populate({
    path: 'user',
    select: 'firstName lastName email',
  });
  this.populate({
    path: 'delivery.address',
    select:
      'firstName lastName email city country company address1 address2 postalCode phone',
  });
  next();
});

orderSchema.pre<Query<IOrder, IOrder>>(/^find/, function (next) {
  this.where({ active: true });
  next();
});

const Order = model<IOrder>('Order', orderSchema);

export default Order;
