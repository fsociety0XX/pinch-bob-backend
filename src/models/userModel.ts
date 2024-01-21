// import crypto from 'crypto';
import { Schema, model, Query, Types } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import {
  USER_SCHEMA_VALIDATION,
  brandEnum,
  roleEnum,
} from '@src/constants/messages';

interface IWishlist {
  _id: Types.ObjectId;
}

interface ICart {
  _id: Types.ObjectId;
  refImg?: [string];
  quantity?: number;
  size?: string;
  piece?: number;
  flavour?: string;
  message?: string;
}

interface IProfile {
  key: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface IUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  profile: IProfile;
  brand: string;
  role: string;
  birthday?: Date;
  confirmPassword: string | undefined;
  wishlist?: Types.DocumentArray<IWishlist>;
  cart?: Types.DocumentArray<ICart>;
  passwordChangedAt: Date;
  resetPasswordToken: string;
  resetPasswordTokenExpiresIn: Date;
  active: boolean;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, USER_SCHEMA_VALIDATION.firstName],
    },
    lastName: {
      type: String,
      required: [true, USER_SCHEMA_VALIDATION.lastName],
    },
    email: {
      type: String,
      unique: true,
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
      required: [true, USER_SCHEMA_VALIDATION.phone],
    },
    profile: {
      key: String,
      name: String,
      mimeType: String,
      size: Number,
      url: String,
    },
    brand: {
      type: String,
      required: [true, USER_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    role: {
      type: String,
      default: roleEnum[1], // default role -> customer
      enum: roleEnum,
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
        type: Schema.ObjectId,
        ref: 'Product',
        refImg: [String],
        quantity: Number,
        size: String,
        piece: Number,
        flavour: String,
        message: String,
      },
    ],
    passwordChangedAt: Date,
    resetPasswordToken: String,
    resetPasswordTokenExpiresIn: Date,
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

userSchema.pre<Query<IUser, IUser>>(/^find/, function (next) {
  this.find({ active: true });
  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // encrypt password
  this.password = await bcrypt.hash(this.password, 12);

  // remove confirmPassword so it's not stored in DB.
  this.confirmPassword = undefined;
  return next();
});

const User = model<IUser>('User', userSchema);

export default User;
