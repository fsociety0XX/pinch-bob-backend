import mongoose from 'mongoose';
import { COMMON_SCHEMA_VALIDATION } from '@src/constants/messages';
import { brandEnum, deliveryTypeEnum } from '@src/types/customTypes';

interface IPhoto {
  key: string;
  originalname: string;
  mimetype: string;
  size: number;
  location: string;
}

interface IRecipInfo {
  name: string;
  contact: number;
}

interface ISummary {
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

interface IProduct {
  id: mongoose.Schema.Types.ObjectId;
  quantity?: number;
  size?: mongoose.Schema.Types.ObjectId;
  pieces?: mongoose.Schema.Types.ObjectId;
  flavour?: mongoose.Schema.Types.ObjectId;
  refImage?: IPhoto[];
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
  summary: ISummary;
  recipInfo: IRecipInfo;
  paid: boolean;
  orderStatus: string;
}

const ProductImageSchema = new mongoose.Schema({
  key: String,
  originalname: String,
  mimetype: String,
  size: Number,
  location: String,
});

const ProductSchema = new mongoose.Schema<IProduct>({
  id: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
  },
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const orderSchema = new mongoose.Schema<IOrderSchema>({
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
      required: [true, 'An order must have a product'],
    },
  ],
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
  },
  delivery: {
    type: DeliverySchema,
    required: [true, 'Delivery details are for the order'],
  },
});
