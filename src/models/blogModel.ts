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

export interface IBlog {
  brand: string;
  title: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  category: mongoose.Schema.Types.ObjectId;
  images: IPhoto[];
  active: boolean;
}

const BlogImageSchema = new mongoose.Schema<IPhoto>({
  key: String,
  originalname: String,
  mimetype: String,
  size: Number,
  location: String,
});

const blogSchema = new mongoose.Schema<IBlog>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    title: String,
    description: String,
    images: {
      type: [BlogImageSchema],
    },
    metaTitle: String,
    metaDescription: String,
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

const Blog = mongoose.model('Blog', blogSchema);

export default Blog;
