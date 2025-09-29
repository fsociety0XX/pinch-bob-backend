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
  contact: string;
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
  date: Date;
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

interface IMoneyPulling {
  noteType: string;
  qty: number;
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
  otherSize: string;
  pieces?: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
  };
  flavour?: {
    id: mongoose.Schema.Types.ObjectId;
    name: string;
  };
  otherFlavour?: string;
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
  fondantNameTwo?: string;
  fondantNumber?: string;
  wantMoneyPulling?: boolean;
  ediblePrints?: string;
  fondantFigurine?: string;
  complexFonAcc?: string;
  nonFondantDecor?: string;
  simpleFonAcc?: string;
  baseColour?: string;
  toys?: string;
  candlesAndSparklers?: string;
  moneyPulling?: IMoneyPulling[];
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
  paymentDate: Date;
}

export interface IOtherProduct {
  name: string;
  price: number;
  flavour: string;
  size: string;
  quantity: number;
  specialInstructions?: string;
  ediblePrints: string;
  refImages: string[];
  additionalRefImages?: IPhoto[];
  giftCardMsg: string;
  notes: string;
  fondantName?: string;
  fondantNameTwo?: string;
  fondantNumber?: string;
  complexAccessories?: string;
  moneyPulling: IMoneyPulling[];
  fondantFigurine?: string;
  complexFonAcc?: string;
  nonFondantDecor?: string;
  simpleFonAcc?: string;
  baseColour?: string;
  toys?: string;
  candlesAndSparklers?: string;
  isMoneyPulling?: boolean;
  superCategory: mongoose.Schema.Types.ObjectId;
  category: mongoose.Schema.Types.ObjectId;
  subCategory: mongoose.Schema.Types.ObjectId;
}

export interface ICustomFormProduct {
  product?: mongoose.Schema.Types.ObjectId;
  flavour?: mongoose.Schema.Types.ObjectId;
  productName?: string;
  quantity: number;
  qtyType?: string;
  indPacked?: boolean;
  size?: string;
  giftCardMsg?: string;
  specialRequest?: string;
  moneyPulling?: IMoneyPulling[];
  superCategory?: mongoose.Schema.Types.ObjectId;
  category?: mongoose.Schema.Types.ObjectId;
  subCategory?: mongoose.Schema.Types.ObjectId;
}

interface ICustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface IOrder {
  id: string;
  orderNumber?: string;
  sqlId: number;
  gaClientId?: string;
  brand: string;
  deliveryType: string; // multi or single location delivery
  product: IProduct[];
  otherProduct: IOtherProduct[];
  customFormProduct: ICustomFormProduct[];
  user: IUser;
  delivery: IDelivery;
  pricingSummary: IPricingSummary;
  customer: ICustomer;
  recipInfo?: IRecipInfo;
  paid: boolean;
  corporate: boolean;
  moneyReceivedForMoneyPulling: boolean;
  moneyPaidForMoneyPulling?: boolean;
  moneyPullingPrepared?: boolean;
  isMoneyPulling?: boolean; // to check if money pulling is there in otherProduct or customFormProduct
  preparationStatus: string;
  status: string; // woodelivery
  stripeDetails: StripeWebhookEvent;
  hitpayDetails: IHitpayDetails;
  woodeliveryTaskId: string;
  driverDetails?: {
    id: string;
    name: string;
  };
  customiseCakeForm: boolean;
  customiseCakeFormDetails: mongoose.Schema.Types.ObjectId;
  forKitchenUse: boolean;
  active: boolean;
  createdAt: string;
}

const CustomerSchema = new mongoose.Schema<ICustomer>({
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
});

const ProductImageSchema = new mongoose.Schema<IPhoto>({
  key: String,
  originalname: String,
  mimetype: String,
  size: Number,
  location: String,
});

const MoneyPullingSchema = new mongoose.Schema<IMoneyPulling>({
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
});

const OtherProductSchema = new mongoose.Schema<IOtherProduct>({
  name: String,
  price: Number,
  flavour: String,
  size: String,
  quantity: Number,
  specialInstructions: String,
  ediblePrints: String,
  refImages: [String],
  additionalRefImages: [ProductImageSchema],
  giftCardMsg: String,
  notes: String,
  fondantName: String,
  fondantNameTwo: String,
  fondantNumber: String,
  complexAccessories: String,
  moneyPulling: [MoneyPullingSchema],
  fondantFigurine: String,
  complexFonAcc: String,
  nonFondantDecor: String,
  simpleFonAcc: String,
  baseColour: String,
  toys: String,
  candlesAndSparklers: String,
  superCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperCategory' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
  isMoneyPulling: {
    type: Boolean,
    default: false,
  },
});

const CustomFormProductSchema = new mongoose.Schema<ICustomFormProduct>({
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
  },
  flavour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Flavour',
  },
  productName: String,
  quantity: Number,
  qtyType: String,
  indPacked: Boolean,
  size: String,
  giftCardMsg: String,
  specialRequest: String,
  moneyPulling: [MoneyPullingSchema],
  superCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperCategory',
    required: false,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false,
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: false,
  },
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
  otherSize: String,
  pieces: {
    type: mongoose.Schema.ObjectId,
    ref: 'Pieces',
  },
  flavour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Flavour',
  },
  otherFlavour: String,
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
  fondantNameTwo: String,
  fondantNumber: String,
  complexFonAcc: String,
  ediblePrints: String,
  nonFondantDecor: String,
  simpleFonAcc: String,
  baseColour: String,
  toys: String,
  candlesAndSparklers: String,
  fondantFigurine: String,
  wantMoneyPulling: {
    type: Boolean,
    default: false,
  },
  moneyPulling: [MoneyPullingSchema],
  address: String,
});

const DeliverySchema = new mongoose.Schema<IDelivery>({
  date: Date,
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
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },
    sqlId: {
      type: Number,
      unique: true,
    },
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
    otherProduct: [OtherProductSchema],
    customFormProduct: [CustomFormProductSchema],
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
    customer: CustomerSchema,
    recipInfo: {
      sameAsSender: Boolean,
      name: String,
      contact: String,
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
    moneyReceivedForMoneyPulling: {
      type: Boolean,
      default: false,
    },
    moneyPaidForMoneyPulling: {
      type: Boolean,
      default: false,
    },
    moneyPullingPrepared: {
      type: Boolean,
      default: false,
    },
    isMoneyPulling: {
      type: Boolean,
      default: false,
    },
    preparationStatus: {
      type: String,
      default: preparationStatusType[0],
      enum: preparationStatusType,
    },
    status: String,
    stripeDetails: Object,
    hitpayDetails: Object,
    woodeliveryTaskId: String,
    driverDetails: {
      id: String,
      name: String,
    },
    customiseCakeForm: {
      type: Boolean,
      default: false,
    },
    customiseCakeFormDetails: {
      type: mongoose.Schema.ObjectId,
      ref: 'CustomiseCake',
    },
    forKitchenUse: {
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
  if (!this.orderNumber) {
    this.orderNumber = generateUniqueIds();
  }
  next();
});

orderSchema.pre<Query<IOrder, IOrder>>(/^find/, function (next) {
  this.populate({
    path: 'delivery.address',
    select:
      'firstName lastName email city country company address1 address2 postalCode phone unitNumber',
  });
  this.populate({
    path: 'delivery.method product.size product.colour product.pieces product.flavour customFormProduct.product customFormProduct.flavour',
    select: 'name images inventory updatedAt duration',
  });
  this.populate({
    path: 'user',
    select: 'firstName lastName email phone',
  });
  this.populate({
    path: 'pricingSummary.coupon',
    select: 'code type applicableOn ids discountType discount',
  });
  this.populate({
    path: 'customiseCakeFormDetails',
  });
  this.populate({
    path: 'product.product',
    populate: [{ path: 'flavour', model: 'Flavour' }],
  });
  next();
});

const Order = model<IOrder>('Order', orderSchema);

export default Order;
