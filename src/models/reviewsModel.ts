import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  authorName: string;
  authorUrl?: string;
  language: string;
  originalLanguage?: string;
  profilePhotoUrl: string;
  rating: number;
  relativeTimeDescription: string;
  text: string;
  time: number;
  translated?: boolean;
}

export interface IReviewsCache extends Document {
  placeId: string;
  reviews: IReview[];
  lastUpdated: Date;
  nextUpdateDue: Date;
  totalRating?: number;
  reviewCount?: number;
  createdAt: Date;
  updatedAt: Date;
  needsUpdate(): boolean;
  scheduleNextUpdate(): void;
}

const reviewSchema = new Schema<IReview>({
  authorName: {
    type: String,
    required: true,
  },
  authorUrl: String,
  language: {
    type: String,
    required: true,
  },
  originalLanguage: String,
  profilePhotoUrl: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  relativeTimeDescription: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  time: {
    type: Number,
    required: true,
  },
  translated: {
    type: Boolean,
    default: false,
  },
});

const reviewsCacheSchema = new Schema<IReviewsCache>(
  {
    placeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reviews: [reviewSchema],
    lastUpdated: {
      type: Date,
      required: true,
      default: Date.now,
    },
    nextUpdateDue: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      index: true,
    },
    totalRating: {
      type: Number,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
reviewsCacheSchema.index({ placeId: 1, nextUpdateDue: 1 });

// Method to check if reviews need updating
reviewsCacheSchema.methods.needsUpdate = function (): boolean {
  return new Date() >= this.nextUpdateDue;
};

// Method to schedule next update (7 days from now)
reviewsCacheSchema.methods.scheduleNextUpdate = function (): void {
  this.nextUpdateDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  this.lastUpdated = new Date();
};

export default mongoose.model<IReviewsCache>(
  'ReviewsCache',
  reviewsCacheSchema
);
