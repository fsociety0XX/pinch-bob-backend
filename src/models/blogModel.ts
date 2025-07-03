import mongoose from 'mongoose';
import slugify from 'slugify';
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
  views: number;
  slug: string;
  postDate: Date;
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
    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    metaTitle: String,
    metaDescription: String,
    views: {
      type: Number,
      default: 0,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    postDate: Date,
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

blogSchema.index({ slug: 1, brand: 1 }, { unique: true });
blogSchema.pre('save', function (next) {
  this.slug = slugify(this.slug, { lower: true, strict: true });
  next();
});

blogSchema.pre('find', function (next) {
  this.populate({
    path: 'category',
    select: 'name',
  });
  next();
});

const Blog = mongoose.model('Blog', blogSchema);

export default Blog;
