import mongoose from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import { COMMON_SCHEMA_VALIDATION } from '@src/constants/messages';

export interface IFlavour {
  brand: string;
  name: string;
  isGlobal: boolean;
  active: boolean;
}

const flavourSchema = new mongoose.Schema<IFlavour>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    name: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.name],
      trim: true,
    },
    isGlobal: {
      type: Boolean,
      default: true,
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

flavourSchema.index({ name: 1, brand: 1 }, { unique: true });

const Flavour = mongoose.model('Flavour', flavourSchema);

export default Flavour;
