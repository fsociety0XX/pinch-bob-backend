import crypto from 'crypto';
import mongoose, { Schema, model, Types, Model, Query } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import {
  ORDER_SCHEMA_VALIDATION,
  USER_SCHEMA_VALIDATION,
} from '@src/constants/messages';
import { Role, brandEnum, notesEnum } from '@src/types/customTypes';
import { generateUniqueIds } from '@src/utils/functions';

interface IWishlist {
  _id: Types.ObjectId;
}
interface IPhoto {
  key: string;
  originalname: string;
  mimetype: string;
  size: number;
  location: string;
}

interface ICart {
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
  card: string;
  refImage?: IPhoto;
  msg?: string;
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

const ProductImageSchema = new mongoose.Schema<IPhoto>({
  key: String,
  originalname: String,
  mimetype: String,
  size: Number,
  location: String,
});

export interface IUser {
  _id: string;
  sqlId: number;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  photo: IPhoto;
  brand: string;
  role: string;
  birthday?: Date;
  confirmPassword: string | undefined;
  wishlist?: Types.DocumentArray<IWishlist>;
  cart?: ICart[];
  passwordChangedAt: Date;
  resetPasswordToken: string | undefined;
  resetPasswordTokenExpiresIn: Date | undefined;
  otp: string;
  otpTimestamp: Date;
  usedCoupons?: mongoose.Schema.Types.ObjectId[];
  otpDailyCount: number;
  otpWindowStart: Date | undefined;
  otpCooldownUntil: Date | undefined;
  active: boolean;
}

export interface IUserMethods {
  comparePassword(
    enteredPassword: string,
    userPassword: string
  ): Promise<boolean>;
  compareTimestamps(tokenIssuedTime: number): boolean;
  generateResetPasswordToken(): string;
}

// eslint-disable-next-line @typescript-eslint/ban-types
type UserModel = Model<IUser, {}, IUserMethods>;

const CartSchema = new mongoose.Schema<ICart>({
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
  card: String,
  refImage: ProductImageSchema,
  msg: String,
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

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    sqlId: {
      type: Number,
      unique: true,
    },
    userId: {
      type: String,
      unique: true,
    },
    firstName: {
      type: String,
      trim: true,
      default: 'Guest',
    },
    lastName: {
      type: String,
      trim: true,
      default: 'User',
    },
    email: {
      type: String,
      lowercase: true,
      validate: [validator.isEmail, USER_SCHEMA_VALIDATION.invalidEmail],
      default: null,
    },
    password: {
      type: String,
      // TODO: Uncomment this line after all users are migrated
      // required: [true, USER_SCHEMA_VALIDATION.password],
      minLength: 8,
      select: false,
    },
    phone: {
      type: String,
      default: null,
    },
    photo: {
      key: String,
      originalname: String,
      mimetype: String,
      size: Number,
      location: String,
    },
    brand: {
      type: String,
      required: [true, USER_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    otpDailyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    otpWindowStart: {
      type: Date, // start of the current 24h window
    },
    otpCooldownUntil: {
      type: Date, // block rapid resends (e.g., 60s)
    },
    role: {
      type: String,
      default: Role.CUSTOMER, // default role -> customer
      enum: Role,
    },
    birthday: {
      type: Date,
    },
    confirmPassword: {
      type: String,
      // TODO: Uncomment this line after all users are migrated
      // required: [true, USER_SCHEMA_VALIDATION.confirmPassword],
      validate: {
        message: USER_SCHEMA_VALIDATION.mismatchPasswords,
        validator(this: IUser, value: string): boolean {
          return value === this.password;
        },
      },
    },
    wishlist: [
      {
        type: Schema.ObjectId,
        ref: 'Product',
      },
    ],
    cart: [CartSchema],
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    resetPasswordToken: String,
    resetPasswordTokenExpiresIn: Date,
    usedCoupons: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Coupon' }],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
    otp: String,
    otpTimestamp: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Unique email per brand (only when email exists and is not empty/null)
userSchema.index(
  { brand: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: 'string' },
    },
  }
);

// Unique phone per brand (only when phone exists and is not empty/null)
userSchema.index(
  { brand: 1, phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $type: 'string' },
    },
  }
);

userSchema.pre('save', async function (next) {
  this.userId = generateUniqueIds();
  if (!this.isModified('password')) return next();
  // encrypt password
  this.password = await bcrypt.hash(this.password, 12);

  // remove confirmPassword so it's not stored in DB.
  this.confirmPassword = undefined;
  return next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = new Date(Date.now() - 1000); // just to make sure everything is fine
  return next();
});

userSchema.pre<Query<IUser, IUser>>(/^find/, function (next) {
  this.populate({
    path: 'wishlist cart.product cart.size cart.pieces cart.colour cart.flavour',
    select: 'name images price discountedPrice slug',
  });
  return next();
});

// Instance method
userSchema.methods.comparePassword = async function (
  enteredPassword: string,
  userPassword: string
): Promise<boolean> {
  const result = await bcrypt.compare(enteredPassword, userPassword);
  return result;
};

userSchema.methods.compareTimestamps = function (
  tokenIssuedTime: number
): boolean {
  if (this.passwordChangedAt) {
    const passwordChangedTimestamp = this.passwordChangedAt.getTime() / 1000;

    return passwordChangedTimestamp > tokenIssuedTime;
  }

  // False means password not changed
  return false;
};

userSchema.methods.generateResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordTokenExpiresIn = new Date(Date.now() + 10 * 60 * 1000);
  return resetToken;
};

const User = model<IUser, UserModel>('User', userSchema);

export default User;
