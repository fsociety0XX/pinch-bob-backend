import mongoose from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import { COMMON_SCHEMA_VALIDATION } from '@src/constants/messages';

interface IPhoto {
  key: string;
  originalname: string;
  mimetype: string;
  size: number;
  location: string;
}

export interface ICategory {
  brand: string;
  name: string;
  title: string;
  description: string;
  image: IPhoto;
  content: string;
  active: boolean;
}

const categorySchema = new mongoose.Schema<ICategory>(
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
    title: String,
    description: String,
    image: {
      key: String,
      originalname: String,
      mimetype: String,
      size: Number,
      location: String,
    },
    content: String,
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

categorySchema.index({ name: 1, brand: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;
