import mongoose, { Types, model } from 'mongoose';
import slugify from 'slugify';
import { brandEnum, refImageType, typeEnum } from '@src/types/customTypes';
import { PRODUCT_SCHEMA_VALIDATION } from '@src/constants/messages';

interface ISize {
  size: mongoose.Types.ObjectId;
  price: number;
}

interface IPieces {
  pieces: mongoose.Types.ObjectId;
  price: number;
}

interface IPhoto {
  key: string;
  originalname: string;
  mimetype: string;
  size: number;
  location: string;
}

interface IPinchProductDetails {
  details: string;
  dietaryAdvice: string;
  shelfLife: string;
  sizesAndPortions: string;
}

interface IBobProductDetails {
  description: string[];
  sizesDetails: string;
  advice: string;
  ingredients: string;
  shelfLife: string;
  howArrives: string;
}

interface IProduct {
  name: string;
  slug: string;
  price: number;
  discountedPrice?: number;
  currency: string;
  brand: string;
  ratingsAvg: number;
  totalRatings: number;
  piecesDetails?: IPieces[];
  sizeDetails?: ISize[];
  images: IPhoto[];
  flavour?: mongoose.Types.ObjectId[];
  colour?: mongoose.Types.ObjectId[];
  type: string; // cake, bake or others
  pinchDetails: IPinchProductDetails;
  bobDetails: IBobProductDetails;
  maxQty?: number;
  minQty?: number;
  refImageType?: string; // edible or customise
  preparationDays: number;
  available: boolean; // will be used to show 'sold out' tags
  recommended: boolean;
  active: boolean;
  superCategory: Types.ObjectId;
  category: Types.ObjectId;
  fbt: string[]; // frequently bought together
  tag: string[]; // can be used to less sweet/ vegan labels to show in product
  sold: number;
  fondantName: boolean;
  fondantNumber: boolean;
}

const ProductImageSchema = new mongoose.Schema({
  key: String,
  originalname: String,
  mimetype: String,
  size: Number,
  location: String,
});

const PinchProductDetailSchema = new mongoose.Schema<IPinchProductDetails>({
  details: String,
  dietaryAdvice: String,
  shelfLife: String,
  sizesAndPortions: String,
});

const BobProductDetailSchema = new mongoose.Schema<IBobProductDetails>({
  description: [String],
  sizesDetails: String,
  advice: String,
  ingredients: String,
  shelfLife: String,
  howArrives: String,
});

const productSchema = new mongoose.Schema<IProduct>(
  {
    name: {
      type: String,
      trim: true,
      required: [true, PRODUCT_SCHEMA_VALIDATION.name],
    },
    slug: String,
    price: {
      type: Number,
      required: [true, PRODUCT_SCHEMA_VALIDATION.price],
    },
    discountedPrice: Number,
    currency: {
      type: String,
      default: 'SGD',
    },
    brand: {
      type: String,
      required: [true, PRODUCT_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    ratingsAvg: {
      type: Number,
      default: 4.5,
      min: [1, PRODUCT_SCHEMA_VALIDATION.minRatingsAvg],
      max: [5, PRODUCT_SCHEMA_VALIDATION.maxRatingsAvg],
      set: (val: number) => Math.round(val * 10) / 10, // 4.666666 -> 46.66666 -> 47 -> 4.7
    },
    sold: Number,
    totalRatings: {
      type: Number,
      default: 0,
    },
    piecesDetails: [
      {
        pieces: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Pieces',
        },
        price: Number,
      },
    ],
    sizeDetails: [
      {
        size: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Size',
        },
        price: Number,
      },
    ],
    images: {
      type: [ProductImageSchema],
      required: [true, PRODUCT_SCHEMA_VALIDATION.images],
      validate: {
        validator(images: IPhoto[]) {
          return images.length;
        },
        message: PRODUCT_SCHEMA_VALIDATION.atleastOneImage,
      },
    },
    flavour: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Flavour',
      },
    ],
    colour: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Colour',
      },
    ],
    type: {
      type: String,
      required: [true, PRODUCT_SCHEMA_VALIDATION.type],
      enum: typeEnum,
    },
    pinchDetails: {
      type: PinchProductDetailSchema,
      validate: {
        validator(this: IProduct, value: IPinchProductDetails) {
          // `this` refers to the current document
          if (this.brand === brandEnum[0]) {
            // If brand is 'pinch', check if `pinchDetails` is not null or undefined
            return value != null;
          }
          // If brand is not 'pinch', validation passes regardless of `pinchDetails`
          return true;
        },
        message: PRODUCT_SCHEMA_VALIDATION.detail,
      },
    },
    bobDetails: {
      type: BobProductDetailSchema,
      validate: {
        validator(this: IProduct, value: IBobProductDetails) {
          if (this.brand === brandEnum[1]) {
            return value != null;
          }
          return true;
        },
        message: PRODUCT_SCHEMA_VALIDATION.detail,
      },
    },
    maxQty: Number,
    minQty: {
      type: Number,
      default: 1,
    },
    refImageType: {
      type: String,
      enum: refImageType,
    },
    preparationDays: {
      type: Number,
      required: [true, PRODUCT_SCHEMA_VALIDATION.preparationDays],
    },
    available: {
      type: Boolean,
      default: true,
    },
    recommended: {
      type: Boolean,
      default: false,
    },
    fondantNumber: {
      type: Boolean,
      default: false,
    },
    fondantName: {
      type: Boolean,
      default: false,
    },
    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, PRODUCT_SCHEMA_VALIDATION.category],
      },
    ],
    superCategory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperCategory',
        required: [true, PRODUCT_SCHEMA_VALIDATION.superCategory],
      },
    ],
    fbt: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
      },
    ],
    tag: [String],
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

productSchema.index({ price: 1, ratingsAverage: -1 });
productSchema.index({ slug: 1, brand: 1 }, { unique: true });

// When reviews are ready
// productSchema.virtual('reviews', {
//   ref: 'Reviews',
//   foreignField: 'product',
//   localField: '_id',
// });

// Document middleware
productSchema.pre('save', function (next) {
  this.slug = slugify(this.name);
  next();
});

// Query middleware
productSchema.pre('findOne', function (next) {
  let alreadyPopulated = false;
  if (!alreadyPopulated) {
    this.populate({
      path: 'fbt',
      select: 'name price images category discountedPrice',
    });
    alreadyPopulated = true;
  }
  next();
});

const Product = model<IProduct>('Product', productSchema);

export default Product;
