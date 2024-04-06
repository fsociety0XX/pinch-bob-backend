import mongoose, { Query } from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import { COMMON_SCHEMA_VALIDATION } from '@src/constants/messages';

export interface IFlavour {
  brand: string;
  name: string;
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

flavourSchema.pre<Query<IFlavour, IFlavour>>(/^find/, function (next) {
  this.where({ active: true });
  next();
});

const Flavour = mongoose.model('Flavour', flavourSchema);

export default Flavour;
