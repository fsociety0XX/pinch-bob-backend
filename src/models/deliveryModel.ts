import mongoose from 'mongoose';
import { brandEnum } from '@src/types/customTypes';
import { COMMON_SCHEMA_VALIDATION } from '@src/constants/messages';

export interface IDriver {
  id: 'string';
  email: 'string';
  phoneNumber: 'string';
  firstName: 'string';
  lastName: 'string';
}
export interface IDelivery {
  brand: string;
  order: mongoose.Schema.Types.ObjectId;
  deliveryDate: string;
  method: mongoose.Schema.Types.ObjectId;
  collectionTime: string;
  address: mongoose.Schema.Types.ObjectId;
  recipientName: string;
  recipientPhone: string;
  woodeliveryTaskId: string;
  driverDetails?: IDriver;
  status?: string;
  active: boolean;
}

const DriverSchema = new mongoose.Schema<IDriver>({
  id: String,
  email: String,
  firstName: String,
  lastName: String,
  phoneNumber: String,
});

const deliverySchema = new mongoose.Schema<IDelivery>(
  {
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    order: {
      type: mongoose.Schema.ObjectId,
      ref: 'Order',
    },
    deliveryDate: String,
    method: {
      type: mongoose.Schema.ObjectId,
      ref: 'DeliveryMethod',
    },
    collectionTime: String,
    address: {
      type: mongoose.Schema.ObjectId,
      ref: 'Address',
    },
    recipientName: String,
    recipientPhone: String,
    woodeliveryTaskId: String,
    driverDetails: DriverSchema,
    status: String,
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

deliverySchema.pre('findOne', function (next) {
  this.populate({
    path: 'method',
    select: 'name',
  });
  this.populate({
    path: 'address',
    select:
      'firstName lastName email city country company address1 address2 postalCode phone',
  });
  next();
});

const Delivery = mongoose.model('Delivery', deliverySchema);

export default Delivery;
