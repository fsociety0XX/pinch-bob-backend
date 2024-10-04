import crypto from 'crypto';
import mongoose, { Schema, model, Types, Model } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import { USER_SCHEMA_VALIDATION } from '@src/constants/messages';
import { Role, brandEnum } from '@src/types/customTypes';

interface IWishlist {
  _id: Types.ObjectId;
}

interface ICart {
  product: Types.ObjectId;
  refImg?: [string];
  quantity?: number;
  size?: string;
  piece?: number;
  flavour?: string;
  message?: string;
}

interface IPhoto {
  key: string;
  originalname: string;
  mimetype: string;
  size: number;
  location: string;
}

export interface IUser {
  _id: string;
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
  cart?: Types.DocumentArray<ICart>;
  passwordChangedAt: Date;
  resetPasswordToken: string | undefined;
  resetPasswordTokenExpiresIn: Date | undefined;
  otp: string;
  otpTimestamp: Date;
  usedCoupons?: mongoose.Schema.Types.ObjectId[];
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

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    firstName: {
      type: String,
      trim: true,
      required: [true, USER_SCHEMA_VALIDATION.firstName],
    },
    lastName: {
      type: String,
      trim: true,
      required: [true, USER_SCHEMA_VALIDATION.lastName],
    },
    email: {
      type: String,
      required: [true, USER_SCHEMA_VALIDATION.email],
      lowercase: true,
      validate: [validator.isEmail, USER_SCHEMA_VALIDATION.invalidEmail],
    },
    password: {
      type: String,
      required: [true, USER_SCHEMA_VALIDATION.password],
      minLength: 8,
      select: false,
    },
    phone: {
      type: String,
      sparse: true,
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
      required: [true, USER_SCHEMA_VALIDATION.confirmPassword],
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
    cart: [
      {
        product: {
          type: Schema.ObjectId,
          ref: 'Product',
        },
        refImg: [String],
        quantity: Number,
        size: String,
        piece: Number,
        flavour: String,
        message: String,
      },
    ],
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
      select: false,
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

// This is a compound index which ensures that same email can exist in both brands but within specific brands emails should always be unique.
userSchema.index({ email: 1, phone: 1, brand: 1 }, { unique: true });

userSchema.pre('save', async function (next) {
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
