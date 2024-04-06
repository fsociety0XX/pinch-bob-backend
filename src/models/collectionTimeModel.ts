import mongoose, { Query } from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import {
  COLLECTION_TIME_VALIDATION,
  COMMON_SCHEMA_VALIDATION,
} from '@src/constants/messages';

export interface ICollectionTime {
  brand: string;
  startTime: string;
  endTime: string;
  active: boolean;
}

const collectionTimeSchema = new mongoose.Schema<ICollectionTime>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    startTime: {
      type: String,
      required: [true, COLLECTION_TIME_VALIDATION.startTime],
    },
    endTime: {
      type: String,
      required: [true, COLLECTION_TIME_VALIDATION.endTime],
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

collectionTimeSchema.pre<Query<ICollectionTime, ICollectionTime>>(
  /^find/,
  function (next) {
    this.where({ active: true });
    next();
  }
);

const CollectionTime = mongoose.model('CollectionTime', collectionTimeSchema);

export default CollectionTime;
