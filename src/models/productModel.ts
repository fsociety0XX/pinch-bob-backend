import mongoose, { model } from 'mongoose';
import slugify from 'slugify';
import {
  brandEnum,
  inventoryEnum,
  refImageType,
  typeEnum,
} from '@src/types/customTypes';
import { PRODUCT_SCHEMA_VALIDATION } from '@src/constants/messages';
import { generateUniqueIds } from '@src/utils/functions';

interface ISuperCategory {
  _id: mongoose.Types.ObjectId;
  name: string;
}

interface ICategory {
  _id: mongoose.Types.ObjectId;
  name: string;
}

interface ISubCategory {
  _id: mongoose.Types.ObjectId;
  name: string;
}

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
  description: string;
  sizesDetails: string;
  advice: string;
  shelfLife: string;
  deliveryOptions: string;
}

export interface IInventory {
  track: boolean;
  totalQty: number;
  remainingQty: number;
  available: boolean; // will be used in admin panel to track product quantity
  status: string;
}

export interface IProduct {
  _id: string;
  productNumber: string;
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
  flavour?: mongoose.Types.ObjectId[]; // this will be used for specific flavours
  useGlobalFlavors: boolean;
  duration: string;
  colour?: mongoose.Types.ObjectId[];
  cardOptions?: string[];
  fondantMsgOptions?: string[];
  type: string; // cake, bake or others
  pinchDetails: IPinchProductDetails;
  bobDetails: IBobProductDetails;
  maxQty?: number;
  minQty?: number;
  refImageType?: string; // edible or customise
  preparationDays: number;
  recommended: boolean;
  active: boolean;
  superCategory: ISuperCategory[];
  category: ICategory[];
  subCategory: ISubCategory[];
  fbt: string[]; // frequently bought together
  tag: string[]; // can be used to less sweet/ vegan labels to show in product
  filterColours: string[]; // will be used to filter cakes from colour filter option on website
  sold: number;
  fondantName: boolean;
  fondantNameLimit: number;
  fondantNumber: boolean;
  priority: number; // for product sequencing
  inventory: IInventory;
  mayStain: boolean;
  moneyPulling: boolean;
  fixedFlavour: string;
  layering: string;
  baseSponge: {
    baseSpongeType: string;
    otherValue: string;
  };
  baseColour: string;
  cakeMsgLocation: string;
  fondantNameDetails: {
    value: string;
    colour: string;
  };
  fondantNumberDetails: {
    value: string;
    colour: string;
    otherValue: string;
  };
  simpleAcc: string;
  complexAcc: string;
  complexAccHr: string;
  ediblePrint: {
    one: {
      type: string;
      value: string;
    };
    two: {
      type: string;
      value: string;
    };
  };
  fondantFig: string;
  fondantLvl: string;
  metaDesc: string;
  available: boolean; // will be used in FE to show "Out of stock"
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
  description: String,
  sizesDetails: String,
  advice: String,
  shelfLife: String,
  deliveryOptions: String,
});

const Inventory = new mongoose.Schema<IInventory>({
  track: {
    type: Boolean,
    default: false,
  },
  totalQty: Number,
  remainingQty: Number,
  available: {
    type: Boolean,
    default: true,
  },
  status: {
    type: String,
    enum: inventoryEnum,
    default: inventoryEnum[2],
  },
});

const EdiblePrintSchema = new mongoose.Schema({
  type: String,
  value: String,
});

const productSchema = new mongoose.Schema<IProduct>(
  {
    productNumber: {
      type: String,
      unique: true,
    },
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
          return images.length > 0;
        },
        message: PRODUCT_SCHEMA_VALIDATION.atleastOneImage,
      },
    },
    flavour: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Flavour',
        },
      ],
      default: [],
    },
    useGlobalFlavors: {
      type: Boolean,
      default: true,
    },
    duration: String,
    colour: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Colour',
        },
      ],
      default: [],
    },
    cardOptions: { type: [String], default: [] },
    fondantMsgOptions: { type: [String], default: [] },
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
    recommended: {
      type: Boolean,
      default: false,
    },
    fondantNumber: {
      type: Boolean,
      default: false,
    },
    priority: Number,
    fondantName: {
      type: Boolean,
      default: false,
    },
    fondantNameLimit: {
      type: Number,
      default: 9,
    },
    subCategory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory',
      },
    ],
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
    tag: { type: [String], default: [] },
    filterColours: { type: [String], default: [] },
    inventory: Inventory,
    mayStain: Boolean,
    moneyPulling: Boolean,
    fixedFlavour: String,
    layering: String,
    baseSponge: {
      baseSpongeType: String,
      otherValue: String,
    },
    baseColour: String,
    cakeMsgLocation: String,
    fondantNameDetails: {
      value: String,
      colour: String,
    },
    fondantNumberDetails: {
      value: String,
      colour: String,
      otherValue: String,
    },
    simpleAcc: String,
    complexAcc: String,
    complexAccHr: String,
    ediblePrint: {
      one: EdiblePrintSchema,
      two: EdiblePrintSchema,
    },
    fondantFig: String,
    fondantLvl: String,
    metaDesc: String,
    available: {
      type: Boolean,
      default: true,
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

productSchema.index({ price: 1, ratingsAverage: -1 });
productSchema.index({ slug: 1, brand: 1 }, { unique: true });

// productSchema.virtual('views', {
//   ref: 'ProductViews',
//   localField: '_id',
//   foreignField: 'product',
// });

// When reviews are ready
// productSchema.virtual('reviews', {
//   ref: 'Reviews',
//   foreignField: 'product',
//   localField: '_id',
// });

// Document middleware
productSchema.pre('save', function (next) {
  this.productNumber = generateUniqueIds();
  this.slug = slugify(this.slug || this.name);
  next();
});

// Query middleware
productSchema.pre('find', function (next) {
  // this.populate('views');
  this.populate({
    path: 'category superCategory subCategory',
    select: 'name',
  });
  this.sort({ priority: 1, createdAt: -1 });

  next();
});

productSchema.pre('findOne', function (next) {
  this.populate({
    path: 'sizeDetails.size piecesDetails.pieces flavour colour category superCategory subCategory',
    select: 'name',
  });

  let alreadyPopulated = false;
  if (!alreadyPopulated) {
    this.populate({
      path: 'fbt',
      select:
        'name price images category superCategory subCategory discountedPrice slug active refImageType',
    });
    alreadyPopulated = true;
  }
  next();
});

const Product = model<IProduct>('Product', productSchema);

export default Product;
