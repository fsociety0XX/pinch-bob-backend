import mongoose, { Types, model } from 'mongoose';
import { brandEnum, typeEnum } from '@src/types/customTypes';
import { PRODUCT_SCHEMA_VALIDATION } from '@src/constants/messages';

interface ISize {
  name: string;
  price: number;
}

interface IPhoto {
  key: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

interface IProductDetails {
  details: string;
  dietaryAdvice: string;
  shelfLife: string;
  sizesAndPortions: string;
}

interface IProduct {
  name: string;
  price: number;
  discountedPrice?: number;
  currency: string;
  brand: string;
  pieces?: number;
  size?: ISize[];
  images: IPhoto[];
  flavour: string[];
  type: string; // cake or bake ?
  details: IProductDetails;
  maxQty: number;
  recommended: boolean;
  active: boolean;
  category: Types.ObjectId;
  fbt: string[]; // frequently bought together
}

const ProductImageSchema = new mongoose.Schema({
  key: String,
  name: String,
  mimeType: String,
  size: Number,
  url: String,
});

const ProductDetailSchema = new mongoose.Schema({
  details: String,
  dietaryAdvice: String,
  shelfLife: String,
  sizesAndPortions: String,
});

const productSchema = new mongoose.Schema<IProduct>({
  name: {
    type: String,
    trim: true,
    required: [true, PRODUCT_SCHEMA_VALIDATION.name],
  },
  price: {
    type: Number,
    required: [true, PRODUCT_SCHEMA_VALIDATION.price],
  },
  discountedPrice: Number,
  currency: {
    type: String,
    required: [true, PRODUCT_SCHEMA_VALIDATION.currency],
  },
  brand: {
    type: String,
    required: [true, PRODUCT_SCHEMA_VALIDATION.brand],
    enum: brandEnum,
  },
  pieces: Number,
  size: [
    {
      name: String,
      price: Number,
    },
  ],
  images: {
    type: [ProductImageSchema],
    required: [true, PRODUCT_SCHEMA_VALIDATION.images],
  },
  flavour: [String],
  type: {
    type: String,
    required: [true, PRODUCT_SCHEMA_VALIDATION.type],
    enum: typeEnum,
  },
  details: {
    type: ProductDetailSchema,
    required: [true, PRODUCT_SCHEMA_VALIDATION.detail],
  },
  maxQty: Number,
  recommended: {
    type: Boolean,
    default: false,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, PRODUCT_SCHEMA_VALIDATION.category],
  },
  fbt: [String],
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

const Product = model<IProduct>('Product', productSchema);

export default Product;
