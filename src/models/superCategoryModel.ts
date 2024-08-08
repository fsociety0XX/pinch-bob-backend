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

interface IContent {
  title: string;
  description: string;
}

export interface ISuperCategory {
  brand: string;
  name: string;
  title: string;
  description: string;
  image: IPhoto;
  content: IContent[];
  active: boolean;
}

const ContentSchema = new mongoose.Schema<IContent>({
  title: String,
  description: String,
});

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
    content: [ContentSchema],
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

superCategorySchema.index({ name: 1, brand: 1 }, { unique: true });

const SuperCategory = mongoose.model('SuperCategory', superCategorySchema);

export default SuperCategory;
