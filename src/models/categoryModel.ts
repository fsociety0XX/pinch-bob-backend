import mongoose from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import { CATEGORY_SCHEMA_VALIDATION } from '@src/constants/messages';

export interface ICategory {
  brand: string;
  name: string;
}

const categorySchema = new mongoose.Schema<ICategory>(
  {
    brand: {
      type: String,
      required: [true, CATEGORY_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    name: {
      type: String,
      required: [true, CATEGORY_SCHEMA_VALIDATION.name],
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Category = mongoose.model('Category', categorySchema);

export default Category;
