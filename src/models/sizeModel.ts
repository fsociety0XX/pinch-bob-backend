import mongoose, { Query } from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import { COMMON_SCHEMA_VALIDATION } from '@src/constants/messages';

export interface ISize {
  brand: string;
  name: string;
  active: boolean;
}

const sizeSchema = new mongoose.Schema<ISize>(
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

sizeSchema.pre<Query<ISize, ISize>>(/^find/, function (next) {
  this.where({ active: true });
  next();
});

const Size = mongoose.model('Size', sizeSchema);

export default Size;
