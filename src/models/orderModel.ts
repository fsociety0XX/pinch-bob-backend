import Stripe from 'stripe';
import mongoose, { Query, model } from 'mongoose';
import {
  COMMON_SCHEMA_VALIDATION,
  ORDER_SCHEMA_VALIDATION,
} from '@src/constants/messages';
import {
  brandEnum,
  deliveryTypeEnum,
  notesEnum,
  preparationStatusType,
} from '@src/types/customTypes';
import { generateUniqueIds } from '@src/utils/functions';
import { IUser } from './userModel';

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
  discountedAmt: string;
  total: string;
}

interface IDelivery {
  date: string;
  method: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
  };
  collectionTime: string;
  instructions?: string;
  address: {
    id: mongoose.Schema.Types.ObjectId;
    firstName: string;
    lastName: string;
    city: string;
    country: string;
    company?: string;
    address1: string;
    unitNumber?: string;
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
  discountedPrice: number;
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
  card: string; // value selected from card options of the product
  refImage?: IPhoto;
  additionalRefImages?: IPhoto[];
  msg?: string; // gift card message
  cakeMsg: string; // message on cake or board
  specialInstructions?: string;
  fondantName?: string;
  fondantNumber?: string;
  moneyPulling?: {
    want: boolean;
    noteType: string;
    qty: number;
  };
  address?: string; // will be used if delivery type - multi location delivery
}

export interface IHitpayDetails {
  id: string;
  status: string;
  amount: string;
  paymentMethod: string;
  transactionId: string;
  paymentRequestId: string;
  receiptUrl: string;
}

export interface IOrder {
  id: string;
  orderNumber?: string;
  gaClientId?: string;
  brand: string;
  deliveryType: string; // multi or single location delivery
  product: IProduct[];
  user: IUser;
  delivery: IDelivery;
  pricingSummary: IPricingSummary;
  recipInfo?: IRecipInfo;
  paid: boolean;
  corporate: boolean;
  moneyReceivedForMoneyPulling: boolean;
  preparationStatus: string;
  status: string;
  stripeDetails: StripeWebhookEvent;
  hitpayDetails: IHitpayDetails;
  woodeliveryTaskId: string;
  customiseCakeForm: boolean;
  active: boolean;
  createdAt: string;
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
  discountedPrice: Number,
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
  card: String,
  refImage: ProductImageSchema,
  additionalRefImages: [ProductImageSchema],
  msg: String,
  cakeMsg: String,
  specialInstructions: String,
  fondantName: String,
  fondantNumber: String,
  moneyPulling: {
    type: {
      want: {
        type: Boolean,
        default: false,
      },
      noteType: {
        type: String,
        enum: notesEnum,
      },
      qty: {
        type: Number,
        max: [25, ORDER_SCHEMA_VALIDATION.moneyPullingMax],
        validate: {
          validator: Number.isInteger,
          message: ORDER_SCHEMA_VALIDATION.moneyPullingQty,
        },
      },
    },
  },
  address: String,
});

const DeliverySchema = new mongoose.Schema<IDelivery>({
  date: String,
  method: {
    type: mongoose.Schema.ObjectId,
    ref: 'DeliveryMethod',
  },
  collectionTime: String,
  instructions: String,
  address: {
    type: mongoose.Schema.ObjectId,
    ref: 'Address',
  },
});

const PricingSummarySchema = new mongoose.Schema<IPricingSummary>({
  subTotal: String,
  gst: String,
  deliveryCharge: String,
  coupon: {
    type: mongoose.Schema.ObjectId,
    ref: 'Coupon',
  },
  discountedAmt: String,
  total: String,
});

const orderSchema = new mongoose.Schema<IOrder>(
  {
    orderNumber: String,
    gaClientId: String,
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
    corporate: {
      type: Boolean,
      default: false,
    },
    moneyReceivedForMoneyPulling: Boolean,
    preparationStatus: {
      type: String,
      default: preparationStatusType[0],
      enum: preparationStatusType,
    },
    status: String,
    stripeDetails: Object,
    hitpayDetails: Object,
    woodeliveryTaskId: String,
    customiseCakeForm: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

orderSchema.pre('save', function (next) {
  this.orderNumber = generateUniqueIds();
  next();
});

orderSchema.pre<Query<IOrder, IOrder>>(/^find/, function (next) {
  this.populate({
    path: 'delivery.address',
    select:
      'firstName lastName email city country company address1 address2 postalCode phone unitNumber',
  });
  this.populate({
    path: 'product.product delivery.method product.size product.colour product.pieces product.flavour',
    select: 'name images inventory updatedAt',
  });
  this.populate({
    path: 'user',
    select: 'firstName lastName email phone',
  });
  this.populate({
    path: 'pricingSummary.coupon',
    select: 'code type applicableOn ids discountType discount',
  });

  next();
});

const Order = model<IOrder>('Order', orderSchema);

export default Order;
