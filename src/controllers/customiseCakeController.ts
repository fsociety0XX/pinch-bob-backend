/* eslint-disable consistent-return */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose, { ObjectId } from 'mongoose';
import Stripe from 'stripe';
import { NextFunction, Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import {
  StatusCode,
  checkoutSessionFor,
  customiseOrderEnums,
} from '@src/types/customTypes';
import User from '@src/models/userModel';
import {
  calculateBeforeAndAfterDateTime,
  fetchAPI,
} from '@src/utils/functions';
import CustomiseCake, { ICustomiseCake } from '@src/models/customiseCakeModel';
import Address from '@src/models/addressModel';
import AppError from '@src/utils/appError';
import {
  COUPON_SCHEMA_VALIDATION,
  DELIVERY_CREATE_ERROR,
  PINCH_EMAILS,
  NO_DATA_FOUND,
} from '@src/constants/messages';
import sendEmail from '@src/utils/sendEmail';
import Coupon from '@src/models/couponModel';
import Delivery from '@src/models/deliveryModel';
import { CREATE_WOODELIVERY_TASK } from '@src/constants/routeConstants';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface IWoodeliveryResponse extends Response {
  data?: {
    guid: string;
  };
}

interface IDeliveryData {
  brand: string;
  customiseCakeOrder: string;
  deliveryDate: Date;
  method: ObjectId | string;
  collectionTime: string;
  recipientName: string | undefined;
  recipientPhone: number | undefined;
  recipientEmail?: string;
  woodeliveryTaskId?: string;
  address?: ObjectId;
}

interface IWoodeliveryTask {
  taskTypeId: number;
  externalKey: string;
  afterDateTime: Date;
  beforeDateTime: Date;
  requesterName?: string;
  requesterPhone?: string;
  requesterEmail: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  tag1: string;
  destinationAddress?: string;
}

const generatePaymentLink = async (req: Request, customiseCakeId: string) => {
  const customiseCake = await CustomiseCake.findById(customiseCakeId);
  const user = await User.findById(customiseCake?.user);
  const {
    paymentLink: { subject, template, previewText },
  } = PINCH_EMAILS;

  // before creating a new checkout session check if old one is expired
  if (customiseCake?.checkoutSession.id) {
    const session = await stripe.checkout.sessions.retrieve(
      customiseCake?.checkoutSession.id
    );
    if (session.status === 'open') {
      await sendEmail({
        email: user!.email,
        subject,
        template,
        context: { previewText, paymentLink: session.url! },
      });
    }
    return false;
  }

  const productList = [
    {
      quantity: customiseCake!.quantity,
      price_data: {
        currency: 'sgd',
        unit_amount: customiseCake!.price * 100, // Stripe expects amount in cents
        product_data: {
          name: 'Customise Cake',
        },
      },
    },
    {
      quantity: 1,
      price_data: {
        currency: 'sgd',
        unit_amount: (customiseCake!.deliveryFee || 0) * 100, // Stripe expects amount in cents
        product_data: {
          name: 'Delivery Fee',
        },
      },
    },
  ];

  const session = await stripe.checkout.sessions.create({
    customer_email: user?.email,
    payment_method_types: ['paynow', 'card'],
    success_url: `${req.protocol}://${req.get('host')}`,
    mode: 'payment',
    currency: 'sgd',
    line_items: productList,
    metadata: {
      sessionFor: checkoutSessionFor.customiseCake,
      customiseCakeId: String(customiseCake?._id),
    },
  });

  const checkoutSession = {
    id: session.id,
    link: session.url,
  };
  await CustomiseCake.findByIdAndUpdate(customiseCakeId, { checkoutSession });

  await sendEmail({
    email: user!.email,
    subject,
    template,
    context: { previewText, paymentLink: session.url! },
  });

  return false;
};

export const submitCustomerForm = catchAsync(
  async (req: Request, res: Response) => {
    const {
      email,
      firstName,
      lastName,
      phone,
      brand,
      delivery: {
        address: { city, country, address1, address2, postalCode },
      },
    } = req.body;

    // creating user
    const newUser = {
      email,
      firstName,
      lastName,
      phone,
    };
    const filter = { email };
    const update = { $setOnInsert: newUser };
    const options = { upsert: true, returnOriginal: false };
    const result = await User.findOneAndUpdate(filter, update, options);

    // creating address
    const newAddress = {
      brand,
      firstName,
      lastName,
      city,
      country,
      address1,
      address2,
      postalCode,
      phone,
      user: new mongoose.Types.ObjectId(result!._id),
    };
    const createdAddress = await Address.create(newAddress);

    req.body.user = result?._id;
    req.body.delivery.address = createdAddress._id;
    if (req.files?.length) {
      req.body.images = req.files;
    }

    const doc = await CustomiseCake.create(req.body);
    res.status(StatusCode.CREATE).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  }
);

export const submitAdminForm = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.file) {
      req.body.baseColourImg = req.file;
    }
    const doc = await CustomiseCake.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    await generatePaymentLink(req, String(doc._id));

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
    return false;
  }
);

const createDeliveryDocument = async (
  customiseCake: ICustomiseCake,
  isSelfCollect = false,
  task?: IWoodeliveryResponse
) => {
  const {
    delivery: { address, date, time },
    user,
  } = customiseCake;
  const currentUser = await User.findById(user);

  const data: IDeliveryData = {
    brand: 'pinch', // TODO: change when rewriting bob
    customiseCakeOrder: customiseCake?._id,
    deliveryDate: new Date(date),
    method: isSelfCollect
      ? process.env.SELF_COLLECT_DELIVERY_METHOD_ID!
      : process.env.REGULAR_DELIVERY_METHOD_ID!,
    collectionTime: time,
    recipientName: currentUser?.firstName,
    recipientPhone: +currentUser!.phone!,
    recipientEmail: currentUser?.email,
  };

  if (task) {
    data.woodeliveryTaskId = task?.data?.guid;
  }
  if (address.id) {
    data.address = address.id;
  }

  await Delivery.create(data);
};

const createWoodeliveryTask = async (customiseCake: ICustomiseCake) => {
  const {
    orderNumber,
    delivery: { address, date, time },
    user,
  } = customiseCake;

  const currentUser = await User.findById(user);

  const task: IWoodeliveryTask = {
    taskTypeId: 1, // Refer to woodelivery swagger
    externalKey: orderNumber,
    afterDateTime: calculateBeforeAndAfterDateTime(String(date), time)
      .afterDateTime, // UTC
    beforeDateTime: calculateBeforeAndAfterDateTime(String(date), time)
      .beforeDateTime, // UTC
    requesterEmail: currentUser!.email!,
    recipientEmail: currentUser!.email!,
    recipientName: currentUser?.firstName || '',
    recipientPhone: String(currentUser?.phone || ''),
    tag1: 'pinch',
  };

  if (address) {
    task.destinationAddress = `${address.address1}, ${
      address.address2 || ''
    }, ${address.company || ''}, ${address.city}, ${address.country}, ${
      address.postalCode
    }`;
    task.requesterName = `${address.firstName} ${address.lastName}`;
    task.requesterPhone = String(address.phone);
  }

  return fetchAPI(CREATE_WOODELIVERY_TASK, 'POST', task);
};

const createDelivery = async (customiseCake: ICustomiseCake) => {
  const {
    delivery: { deliveryType },
  } = customiseCake;

  const isSelfCollect = deliveryType === customiseOrderEnums.deliveryType[0];
  if (isSelfCollect) {
    createDeliveryDocument(customiseCake, isSelfCollect);
  } else
    createWoodeliveryTask(customiseCake)
      .then(async (response) => {
        const task = await response.json();
        createDeliveryDocument(customiseCake, isSelfCollect, task);
        await CustomiseCake.findByIdAndUpdate(customiseCake?._id, {
          woodeliveryTaskId: task.data.guid,
        });
      })
      .catch((err) => console.error(err, DELIVERY_CREATE_ERROR));
};

export const updateCustomiseCakeOrderAfterPaymentSuccess = async (
  session: Stripe.CheckoutSessionCompletedEvent
) => {
  const {
    id,
    data: { object },
  } = session;

  const customiseCakeOrderId = object?.metadata!.customiseCakeId;
  const stripeDetails = {
    eventId: id,
    checkoutSessionId: object?.id,
    currency: object.currency,
    amount: object.amount_total! / 100, // Since stripe returns amount in cents
    paymentIntent: object?.payment_intent,
    paymentStatus: object?.payment_status,
  };

  const customiseCakeOrder = await CustomiseCake.findByIdAndUpdate(
    customiseCakeOrderId,
    { checkoutSession: {}, stripeDetails, paid: true },
    { new: true }
  );

  if (!customiseCakeOrder) {
    return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
  }

  // If customer has applied coupon
  if (customiseCakeOrder.coupon) {
    // Append coupon details in user model when customer apply a coupon successfully
    const user = await User.findById(customiseCakeOrder.user);
    if (
      user?.usedCoupons &&
      !user.usedCoupons?.includes(customiseCakeOrder.coupon)
    ) {
      user.usedCoupons!.push(customiseCakeOrder.coupon);
    }
    // Increment the coupon's used count atomically
    await Coupon.updateOne(
      { _id: customiseCakeOrder.coupon },
      { $inc: { used: 1 } }
    );
    await user!.save();
  }

  await createDelivery(customiseCakeOrder);

  // Send final confirmation email
  const {
    customiseCakeOrderConfirm: { subject, template, previewText },
  } = PINCH_EMAILS;
  await sendEmail({
    email: object.customer_email!,
    subject,
    template,
    context: {
      previewText,
      orderId: customiseCakeOrder?.id, // TODO: use later
      orderNo: customiseCakeOrder?.orderNumber,
      deliveryDate: new Date(customiseCakeOrder!.delivery.date).toDateString(),
      subTotal: String(customiseCakeOrder.price),
      deliveryCharge: String(customiseCakeOrder.deliveryFee || 0),
      total: String(customiseCakeOrder.price + customiseCakeOrder.deliveryFee),
    },
  });
};

export const sendPaymentLink = catchAsync(
  async (req: Request, res: Response) => {
    await generatePaymentLink(req, req.params.id);
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: COUPON_SCHEMA_VALIDATION.paymentLinkSent,
    });
  }
);
