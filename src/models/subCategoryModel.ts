import mongoose from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import {
  COMMON_SCHEMA_VALIDATION,
  SUBCATEGORY_SCHEMA_VALIDATION,
} from '@src/constants/messages';

interface IPhoto {
  key: string;
  originalname: string;
  mimetype: string;
  size: number;
  location: string;
}

export interface ISubCategory {
  brand: string;
  name: string;
  title: string;
  description: string;
  category: mongoose.Types.ObjectId[];
  image: IPhoto;
  content: string;
  active: boolean;
}

const subCategorySchema = new mongoose.Schema<ISubCategory>(
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
    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, SUBCATEGORY_SCHEMA_VALIDATION.category],
      },
    ],
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

subCategorySchema.index({ name: 1, brand: 1 }, { unique: true });

const SubCategory = mongoose.model('SubCategory', subCategorySchema);

export default SubCategory;
