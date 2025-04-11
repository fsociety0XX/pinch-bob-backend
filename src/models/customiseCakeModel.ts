import mongoose, { Query, model } from 'mongoose';
import {
  COMMON_SCHEMA_VALIDATION,
  ORDER_SCHEMA_VALIDATION,
} from '@src/constants/messages';
import {
  brandEnum,
  customiseOrderEnums,
  notesEnum,
} from '@src/types/customTypes';
import { generateUniqueIds } from '@src/utils/functions';
import { IUser } from './userModel';

interface IPhoto {
  key: string;
  originalname: string;
  mimetype: string;
  size: number;
  location: string;
}

interface IDelivery {
  deliveryType: string;
  date: Date;
  time: string;
  specificTimeSlot: boolean;
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
  recipientName: string;
  recipientPhone: string;
}

interface IBakes {
  product: mongoose.Schema.Types.ObjectId;
  quantity: number;
  qtyType: string;
  indPacked: boolean;
}

interface ICandles {
  product: mongoose.Schema.Types.ObjectId;
  quantity: number;
}

interface IEdiblePrint {
  type: string;
  value: string;
}

interface IFondant {
  type: string;
  colour: string;
  details: string;
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

interface IMoneyPulling {
  noteType: string;
  qty: number;
}

export interface ICustomiseCake {
  _id: string;
  brand: string;
  orderNumber: string;
  user: IUser;
  delivery: IDelivery;
  pax: number;
  specialRequest: string;
  flavour: mongoose.Schema.Types.ObjectId;
  message: string;
  cakeMsgLocation: string;
  images: IPhoto[];
  bakes: IBakes[];
  baseColour: string;
  baseColourImg: IPhoto;
  baseSponge: string;
  colourCode: string;
  drips: string;
  ediblePrints: {
    one: IEdiblePrint;
    two: IEdiblePrint;
  };
  fondantName: IFondant;
  fondantNumber: IFondant;
  fondantLevel: string;
  topper: string;
  fondantFigurine: string;
  toys: string;
  nonFondantDecor: string;
  simpleFonAcc: string;
  complexFonAcc: string;
  complexFonAccHr: number;
  includeGiftCard: boolean;
  giftCardMsg: string;
  includeCoolerBag: boolean;
  coolerBagSize: string;
  candlesAndSparklers: ICandles[];
  moneyPulling?: IMoneyPulling[];
  price: number;
  quantity: number;
  size: string;
  instructions: string;
  coupon: mongoose.Schema.Types.ObjectId;
  formStatus: string;
  enquiryType: string;
  companyName?: string;
  deliveryFee: number;
  discountedAmt: number;
  total: number;
  paid: boolean;
  hitpayDetails: IHitpayDetails;
  paymentLink: string;
  woodeliveryTaskId: string;
  active: boolean;
}

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

const DeliverySchema = new mongoose.Schema<IDelivery>({
  deliveryType: {
    type: String,
    required: [true, 'Delivery type is required'],
    enum: customiseOrderEnums.deliveryType,
  },
  date: Date,
  time: String,
  specificTimeSlot: {
    type: Boolean,
    default: false,
  },
  address: {
    type: mongoose.Schema.ObjectId,
    ref: 'Address',
  },
  recipientName: String,
  recipientPhone: String,
});

const ImageSchema = new mongoose.Schema<IPhoto>({
  key: String,
  originalname: String,
  mimetype: String,
  size: Number,
  location: String,
});

const BakesSchema = new mongoose.Schema<IBakes>({
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
  },
  quantity: Number,
  qtyType: {
    type: String,
    enum: customiseOrderEnums.qtyType,
  },
  indPacked: Boolean,
});

const EdiblePrintSchema = new mongoose.Schema<IEdiblePrint>({
  type: {
    type: String,
    enum: customiseOrderEnums.ediblePrintType,
  },
  value: String,
});

const FondantNameSchema = new mongoose.Schema<IFondant>({
  type: {
    type: String,
    enum: customiseOrderEnums.fondantNameTypes,
  },
  colour: {
    type: String,
    enum: customiseOrderEnums.fondantColours,
  },
  details: String,
});

const FondantNumberSchema = new mongoose.Schema<IFondant>({
  type: {
    type: String,
    enum: customiseOrderEnums.fondantNumberTypes,
  },
  colour: {
    type: String,
    enum: customiseOrderEnums.fondantColours,
  },
  details: String,
});

const CandleSchema = new mongoose.Schema<ICandles>({
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
  },
  quantity: Number,
});

const customiseCakeSchema = new mongoose.Schema<ICustomiseCake>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    orderNumber: String,
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    delivery: {
      type: DeliverySchema,
      required: [true, 'Delivery is required'],
    },
    pax: {
      type: Number,
      required: [true, 'A pax is required'],
    },
    specialRequest: {
      type: String,
      required: [true, 'A special request is required'],
    },
    flavour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Flavour',
      required: [true, 'A flavour is required'],
    },
    message: String,
    cakeMsgLocation: {
      type: String,
      enum: customiseOrderEnums.cakeMsgLocation,
    },
    images: [ImageSchema],
    bakes: [BakesSchema],
    baseColour: String,
    baseColourImg: ImageSchema,
    baseSponge: {
      type: String,
      enum: customiseOrderEnums.baseSponge,
    },
    colourCode: {
      type: String,
      enum: customiseOrderEnums.colourCode,
    },
    drips: String,
    ediblePrints: {
      one: EdiblePrintSchema,
      two: EdiblePrintSchema,
    },
    fondantName: FondantNameSchema,
    fondantNumber: FondantNumberSchema,
    fondantLevel: String,
    topper: String,
    fondantFigurine: String,
    toys: String,
    nonFondantDecor: String,
    simpleFonAcc: {
      type: String,
      enum: customiseOrderEnums.simpleFondAcc,
    },
    complexFonAcc: String,
    complexFonAccHr: Number,
    includeGiftCard: {
      type: Boolean,
      default: false,
    },
    giftCardMsg: String,
    includeCoolerBag: {
      type: Boolean,
      default: false,
    },
    coolerBagSize: String,
    candlesAndSparklers: [CandleSchema],
    moneyPulling: [MoneyPullingSchema],
    deliveryFee: Number,
    discountedAmt: Number,
    total: Number,
    price: Number,
    quantity: Number,
    size: String,
    instructions: String,
    coupon: {
      type: mongoose.Schema.ObjectId,
      ref: 'Coupon',
    },
    formStatus: {
      type: String,
      enum: customiseOrderEnums.formStatusEnum,
      default: 'New',
    },
    enquiryType: {
      type: String,
      enum: customiseOrderEnums.enquiryTypeEnum,
    },
    companyName: String,
    paid: {
      type: Boolean,
      default: false,
    },
    hitpayDetails: Object,
    paymentLink: String,
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

customiseCakeSchema.pre('save', function (next) {
  this.orderNumber = generateUniqueIds();
  next();
});

customiseCakeSchema.pre<Query<ICustomiseCake, ICustomiseCake>>(
  /^find/,
  function (next) {
    this.populate({
      path: 'delivery.address',
      select:
        'firstName lastName email city country company address1 address2 postalCode phone unitNumber',
    });
    this.populate({
      path: 'user',
      select: 'firstName lastName email phone',
    });
    this.populate({
      path: 'bakes.product candlesAndSparklers.product flavour',
      select: 'name images',
    });
    this.populate({
      path: 'coupon',
      select: 'code type applicableOn ids discountType discount',
    });

    next();
  }
);

const CustomiseCake = model<ICustomiseCake>(
  'CustomiseCake',
  customiseCakeSchema
);

export default CustomiseCake;
