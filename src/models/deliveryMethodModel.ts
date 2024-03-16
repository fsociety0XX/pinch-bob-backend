import mongoose from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import {
  COMMON_SCHEMA_VALIDATION,
  DELIVERY_METHOD_VALIDATION,
} from '@src/constants/messages';

export interface IDeliveryMethod {
  brand: string;
  name: string;
  price: string;
  info: string;
  active: boolean;
}

const deliveryMethodSchema = new mongoose.Schema<IDeliveryMethod>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    name: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.name],
      unique: true,
      trim: true,
    },
    price: {
      type: String,
      required: [true, DELIVERY_METHOD_VALIDATION.price],
    },
    info: {
      type: String,
      required: [true, DELIVERY_METHOD_VALIDATION.info],
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

const DeliveryMethod = mongoose.model('DeliveryMethod', deliveryMethodSchema);

export default DeliveryMethod;