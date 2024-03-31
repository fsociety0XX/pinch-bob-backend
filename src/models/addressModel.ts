import mongoose from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import {
  ADDRESS_SCHEMA_VALIDATION,
  COMMON_SCHEMA_VALIDATION,
} from '@src/constants/messages';

export interface IAddress {
  brand: string;
  firstName: string;
  lastName: string;
  city: string;
  country: string;
  company?: string;
  address1: string;
  address2?: string;
  postalCode: string;
  phone: number;
  user: mongoose.Types.ObjectId;
  default: boolean;
  active: boolean;
}

const addressSchema = new mongoose.Schema<IAddress>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    firstName: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.firstName],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.lastName],
      trim: true,
    },
    city: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.city],
      trim: true,
    },
    country: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.country],
      trim: true,
    },
    address1: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.address1],
      trim: true,
    },
    address2: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.address2],
      trim: true,
    },
    company: String,
    postalCode: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.postalCode],
      trim: true,
    },
    phone: {
      type: Number,
      required: [true, ADDRESS_SCHEMA_VALIDATION.phone],
      trim: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    default: {
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

addressSchema.pre('findOne', function (next) {
  this.populate({
    path: 'user',
    select: 'firstName lastName email',
  });
  this.find({ active: true });
  next();
});

const Address = mongoose.model('Address', addressSchema);

export default Address;
