import mongoose from 'mongoose';
import { COMMON_SCHEMA_VALIDATION } from '@src/constants/messages';
import { brandEnum, customiseOrderEnums } from '@src/types/customTypes';

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
  address: mongoose.Schema.Types.ObjectId;
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

interface ICustomiseCake {
  brand: string;
  orderNumber: string;
  user: mongoose.Schema.Types.ObjectId;
  delivery: IDelivery;
  pax: number;
  specialRequest: string;
  flavour: mongoose.Schema.Types.ObjectId;
  message: string;
  messagePlacement: string;
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
  candlesAndSparklers: ICandles[];
  notes: string;
  deliveryFee: number;
  price: number;
  quantity: number;
  size: mongoose.Schema.Types.ObjectId;
  instructions: string;
  coupon: mongoose.Schema.Types.ObjectId;
  formStatus: string;
  enquiryType: string;
  companyName?: string;
  paid: boolean;
  paymentLink: string;
  active: boolean;
}

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
  address: mongoose.Schema.ObjectId,
});

const ImageSchema = new mongoose.Schema<IPhoto>({
  key: String,
  originalname: String,
  mimetype: String,
  size: Number,
  location: String,
});

const BakesSchema = new mongoose.Schema<IBakes>({
  product: mongoose.Schema.ObjectId,
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
  product: mongoose.Schema.ObjectId,
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
      required: [true, 'A flavour is required'],
    },
    message: String,
    messagePlacement: {
      type: String,
      enum: customiseOrderEnums.messagePlacement,
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
    candlesAndSparklers: [CandleSchema],
    notes: String,
    deliveryFee: Number,
    price: Number,
    quantity: Number,
    size: mongoose.Schema.ObjectId,
    instructions: String,
    coupon: mongoose.Schema.ObjectId,
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
    paymentLink: String,
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

const CustomiseCake = mongoose.model('CustomiseCake', customiseCakeSchema);

export default CustomiseCake;
