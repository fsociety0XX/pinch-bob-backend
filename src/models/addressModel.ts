import mongoose, { UpdateQuery } from 'mongoose';
import { StatusCode, brandEnum } from '@src/types/customTypes';
import {
  ADDRESS_SCHEMA_VALIDATION,
  COMMON_SCHEMA_VALIDATION,
} from '@src/constants/messages';
import AppError from '@src/utils/appError';

export interface IAddress {
  brand: string;
  firstName: string;
  lastName: string;
  city: string;
  country: string;
  company?: string;
  unitNumber?: string;
  address1: string;
  address2?: string;
  postalCode: string;
  phone: number;
  user: mongoose.Types.ObjectId;
  default: boolean;
  active: boolean;
}

const addressSchema = new mongoose.Schema<IAddress>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    firstName: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.firstName],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.lastName],
      trim: true,
    },
    city: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.city],
      trim: true,
    },
    country: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.country],
      trim: true,
    },
    unitNumber: {
      type: String,
      trim: true,
    },
    address1: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.address1],
      trim: true,
    },
    address2: {
      type: String,
      trim: true,
    },
    company: String,
    postalCode: {
      type: String,
      required: [true, ADDRESS_SCHEMA_VALIDATION.postalCode],
      trim: true,
    },
    phone: {
      type: Number,
      required: [true, ADDRESS_SCHEMA_VALIDATION.phone],
      trim: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    default: {
      type: Boolean,
      default: false,
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

addressSchema.pre('findOne', function (next) {
  this.populate({
    path: 'user',
    select: 'firstName lastName email',
  });
  next();
});

// addressSchema.pre<Query<IAddress, IAddress>>(/^find/, function (next) {
//   this.where({ active: true });
//   next();
// });

// Middleware to ensure only 1 default address per user when new doc is created
addressSchema.pre('save', async function (next) {
  if (this.default && this.isNew && this.isModified('default')) {
    try {
      await this.model('Address').updateMany(
        {
          user: this.user,
          _id: { $ne: this.id },
        },
        { $set: { default: false } }
      );
      next();
    } catch (err) {
      next(
        new AppError(ADDRESS_SCHEMA_VALIDATION.default, StatusCode.BAD_REQUEST)
      );
    }
  } else {
    next();
  }
});

// Middleware to ensure only 1 default address per user when a doc is updated
addressSchema.pre(
  'findOneAndUpdate',
  async function (this: UpdateQuery<IAddress>, next) {
    // Check if the 'default' field is being modified
    if (this.getUpdate().default) {
      try {
        const updateQuery = this.getQuery();
        const addressId = updateQuery._id;
        const doc = await this.model.findOne({ _id: addressId });
        // Update all other documents for the same user to set 'default' to false
        await this.model.updateMany(
          {
            user: doc.user.id,
            _id: { $ne: addressId },
          },
          { $set: { default: false } }
        );
        next();
      } catch (err) {
        next(
          new AppError(
            ADDRESS_SCHEMA_VALIDATION.default,
            StatusCode.BAD_REQUEST
          )
        );
      }
    } else {
      next();
    }
  }
);

const Address = mongoose.model('Address', addressSchema);

export default Address;
