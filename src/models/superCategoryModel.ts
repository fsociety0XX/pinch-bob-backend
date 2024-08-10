import mongoose from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import { COMMON_SCHEMA_VALIDATION } from '@src/constants/messages';

export interface ISuperCategory {
  brand: string;
  name: string;
  active: boolean;
}

const superCategorySchema = new mongoose.Schema<ISuperCategory>(
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

const SuperCategory = mongoose.model('SuperCategory', superCategorySchema);

export default SuperCategory;
