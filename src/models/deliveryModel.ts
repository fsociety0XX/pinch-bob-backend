import mongoose, { Query } from 'mongoose';
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
  sqlId: number;
  brand: string;
  order?: mongoose.Schema.Types.ObjectId;
  customiseCakeOrder?: mongoose.Schema.Types.ObjectId;
  deliveryDate: Date;
  method: mongoose.Schema.Types.ObjectId;
  collectionTime: string;
  address?: mongoose.Schema.Types.ObjectId;
  recipientName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  woodeliveryTaskId?: string;
  driverDetails?: IDriver;
  status?: string;
  instructions?: string;
  customiseCakeForm: boolean;
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
    sqlId: {
      type: Number,
      unique: true,
    },
    brand: {
      type: String,
      required: [true, COMMON_SCHEMA_VALIDATION.brand],
      enum: brandEnum,
    },
    order: {
      type: mongoose.Schema.ObjectId,
      ref: 'Order',
    },
    customiseCakeOrder: {
      type: mongoose.Schema.ObjectId,
      ref: 'CustomiseCake',
    },
    deliveryDate: Date,
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
    recipientEmail: String,
    woodeliveryTaskId: String,
    driverDetails: DriverSchema,
    status: String,
    instructions: String,
    customiseCakeForm: Boolean,
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

deliverySchema.pre<Query<IDelivery, IDelivery>>(/^find/, function (next) {
  this.populate({
    path: 'method',
    select: 'name',
  });
  this.populate({
    path: 'address',
    select:
      'firstName lastName email city country company address1 address2 postalCode phone unitNumber',
  });
  this.populate({
    path: 'order customiseCakeOrder',
    select: 'orderNumber product updatedAt createdAt',
  });
  next();
});

const Delivery = mongoose.model('Delivery', deliverySchema);

export default Delivery;
