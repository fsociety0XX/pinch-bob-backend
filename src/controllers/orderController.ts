/* eslint-disable consistent-return */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import Stripe from 'stripe';
import cron from 'node-cron';
import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongoose';
import catchAsync from '@src/utils/catchAsync';
import Order, { IOrder } from '@src/models/orderModel';
import { IRequestWithUser } from './authController';
import { Role, StatusCode } from '@src/types/customTypes';
import sendEmail from '@src/utils/sendEmail';
import {
  getAll,
  getOne,
  softDeleteMany,
  softDeleteOne,
  updateOne,
} from '@src/utils/factoryHandler';
import AppError from '@src/utils/appError';
import {
  DELIVERY_CREATE_ERROR,
  EMAILS,
  NO_DATA_FOUND,
  ORDER_AUTH_ERR,
  ORDER_FAIL_EMAIL,
  ORDER_NOT_FOUND,
} from '@src/constants/messages';
import { CREATE_WOODELIVERY_TASK } from '@src/constants/routeConstants';
import {
  calculateBeforeAndAfterDateTime,
  fetchAPI,
  generateOrderId,
} from '@src/utils/functions';
import Delivery from '@src/models/deliveryModel';
import User from '@src/models/userModel';
import Address from '@src/models/addressModel';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const CANCELLED = 'cancelled';

interface IWoodeliveryPackage {
  productId: ObjectId;
  orderId: string;
  quantity: number | undefined;
  price: number;
  field1: string | undefined;
  field2: string | undefined;
  field3: string | undefined;
  field4: string;
  field5: string;
}

interface IWoodeliveryTask {
  taskTypeId: number;
  taskDesc: string;
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
  packages: IWoodeliveryPackage[];
}

interface IDeliveryData {
  brand: string;
  order: string;
  deliveryDate: string;
  method: ObjectId | string;
  collectionTime: string;
  recipientName: string | undefined;
  recipientPhone: number | undefined;
  recipientEmail?: string;
  woodeliveryTaskId?: string;
  address?: ObjectId;
}

// cron
function cancelOrder(id: string) {
  const currentTime = new Date();
  const thirtyMinutesAfterCurrentTime = new Date(
    currentTime.getTime() + 30 * 60 * 1000
  );
  const cronScheduleTime = `${thirtyMinutesAfterCurrentTime.getMinutes()} ${thirtyMinutesAfterCurrentTime.getHours()} * * *`;
  cron.schedule(cronScheduleTime, async () => {
    const order = await Order.findById(id);
    if (!order?.paid && order?.status !== CANCELLED)
      await Order.findByIdAndUpdate(id, { status: CANCELLED });
  });
}

export const placeOrder = catchAsync(
  // eslint-disable-next-line consistent-return
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    req.body.user = req.user?._id;
    let orderId;
    if (req.body.orderId) {
      orderId = req.body.orderId;
    } else {
      const order = await Order.create(req.body);
      orderId = order.id;
    }
    const populatedOrder = await Order.findById(orderId);
    if (!populatedOrder) {
      return next(new AppError(ORDER_NOT_FOUND, StatusCode.BAD_REQUEST));
    }

    const productList = populatedOrder?.product.map(
      ({ product, price, quantity }) => ({
        quantity,
        price_data: {
          currency: 'sgd',
          unit_amount: ((+price?.toFixed(2) / quantity!) * 100).toFixed(0), // Stripe expects amount in cents, Also the reason for dividing price with quantity is that
          // In DB 'price' is the total amount of that product with it's quantity - means originalProductPrice + specialMsg price (if any) * Quantity and in stripe checkout
          // It again gets multiplied by the quantity since stripe thinks that 'price' property contains just originalPrice of 1 product.
          product_data: {
            name: product.name,
            images: [product?.images?.[0]?.location],
          },
        },
      })
    );

    // Add delivery fee as a line item
    productList.push({
      quantity: 1,
      price_data: {
        currency: 'sgd',
        unit_amount: +populatedOrder?.pricingSummary?.deliveryCharge * 100 || 0, // Stripe expects amount in cents
        product_data: {
          name: 'Delivery Fee',
          description: populatedOrder?.delivery?.method?.name,
        },
      },
    });

    // create checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: req.user?.email,
      customer: req.user?._id,
      payment_method_types: ['paynow', 'card'],
      success_url: `${req.protocol}://${req.get(
        'host'
      )}/order-confirm/${orderId}`,
      cancel_url: `${req.protocol}://${req.get(
        'host'
      )}/retry-payment/${orderId}`,
      mode: 'payment',
      currency: 'sgd',
      line_items: productList,
      metadata: {
        orderId,
      },
    });

    // Cancel order after 30 mins if payment fails
    cancelOrder(orderId);
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      session,
    });
  }
);

const createWoodeliveryTask = (order: IOrder) => {
  const {
    orderNumber,
    delivery: { address, date, collectionTime },
    recipInfo,
    user,
  } = order;

  let taskDesc = '';
  const packages = order.product.map(
    (
      { product, quantity, price, size, pieces, flavour, msg, fondantInfo },
      index
    ) => {
      taskDesc += `${index ? ', ' : ''}${quantity} x ${product.name}`;
      return {
        productId: product.id,
        orderId: order.orderNumber,
        quantity,
        price,
        field1: size?.name,
        field2: pieces?.name,
        field3: flavour?.name,
        field4: msg || '',
        field5: fondantInfo || '',
      };
    }
  );
  const task: IWoodeliveryTask = {
    taskTypeId: 1, // Refer to woodelivery swagger
    taskDesc,
    externalKey: orderNumber,
    afterDateTime: calculateBeforeAndAfterDateTime(date, collectionTime)
      .afterDateTime, // UTC
    beforeDateTime: calculateBeforeAndAfterDateTime(date, collectionTime)
      .beforeDateTime, // UTC
    requesterEmail: user?.email,
    recipientName: recipInfo?.name || '',
    recipientPhone: String(recipInfo?.contact || ''),
    tag1: 'pinch',
    packages,
  };
  if (address?.id) {
    task.destinationAddress = `${address.address1}, ${
      address.address2 || ''
    }, ${address.company || ''}, ${address.city}, ${address.country}, ${
      address.postalCode
    }`;
    task.requesterName = `${address.firstName} ${address.lastName}`;
    task.requesterPhone = String(address.phone);
  }
  if (recipInfo?.sameAsSender) {
    task.recipientEmail = user?.email;
  }

  return fetchAPI(CREATE_WOODELIVERY_TASK, 'POST', task);
};

const createDeliveryDocument = async (order: IOrder, task?: Response) => {
  const {
    delivery: { address, method, date, collectionTime },
    recipInfo,
    user,
  } = order;
  const data: IDeliveryData = {
    brand: 'pinch', // TODO: change when rewriting bob
    order: order?.id,
    deliveryDate: date,
    method: method.id,
    collectionTime,
    recipientName: recipInfo?.name,
    recipientPhone: recipInfo?.contact,
  };
  if (task) {
    data.woodeliveryTaskId = task?.data?.guid;
  }
  if (address?.id) {
    data.address = address.id;
  }
  if (!recipInfo || recipInfo?.sameAsSender) {
    data.recipientEmail = user?.email;
  }
  await Delivery.create(data);
};

const createDelivery = async (id: string) => {
  const order = await Order.findById(id);
  if (!order) {
    return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
  }
  const {
    delivery: { method },
  } = order;
  const isSelfCollect =
    String(method.id) === String(process.env.SELF_COLLECT_DELIVERY_METHOD_ID);

  if (isSelfCollect) {
    createDeliveryDocument(order);
  } else
    createWoodeliveryTask(order)
      .then(async (response) => {
        const task = await response.json();
        createDeliveryDocument(order, task);
        await Order.findByIdAndUpdate(id, {
          woodeliveryTaskId: task.data.guid,
        });
      })
      .catch((err) => console.error(err, DELIVERY_CREATE_ERROR));
};

const createProductListForTemplate = (order: IOrder) => {
  const productList = order?.product?.map((p) => ({
    name: p.product.name,
    image: p?.product?.images?.[0]?.location,
    flavour: p.flavour?.name,
    size: p.size?.name,
    quantity: p.quantity,
    price: p.price,
    pieces: p.pieces?.name,
  }));
  return productList;
};

const updateOrderAfterPaymentSuccess = async (
  session: Stripe.CheckoutSessionCompletedEvent,
  res: Response
) => {
  const {
    orderConfirm: { subject, template, previewText },
  } = EMAILS;
  const {
    id,
    data: { object },
  } = session;

  const orderId = object?.metadata!.orderId;
  const stripeDetails = {
    eventId: id,
    checkoutSessionId: object?.id,
    currency: object.currency,
    amount: object.amount_total! / 100, // Since stripe returns amount in cents
    paymentIntent: object?.payment_intent,
    paymentStatus: object?.payment_status,
  };
  const order = await Order.findByIdAndUpdate(
    orderId,
    { stripeDetails, paid: true },
    { new: true }
  )
    .lean()
    .populate({
      path: 'product.product product.size product.colour product.pieces product.flavour',
      select: 'name images',
    });
  await createDelivery(orderId);
  await sendEmail({
    email: object.customer_email!,
    subject,
    template,
    context: {
      previewText,
      orderId: order?.orderNumber,
      orderCreatedAt: new Date(order!.createdAt).toDateString(),
      products: createProductListForTemplate(order!),
      pricingSummary: order!.pricingSummary,
      deliveryDate: new Date(order!.delivery?.date).toDateString(),
    },
  });
  res.status(StatusCode.SUCCESS).send({
    status: 'success',
    message: 'Payment successfull',
  });
};

async function handlePaymentFailure(
  session: Stripe.PaymentIntentPaymentFailedEvent,
  res: Response
) {
  const {
    data: { object },
  } = session;

  const orderId = object?.metadata!.orderId;
  const stripeDetails = {
    currency: object.currency,
    amount: object.amount! / 100, // Since stripe returns amount in cents
    paymentIntent: object?.id,
    paymentStatus: object?.status,
    error: object?.last_payment_error,
  };
  await Order.findByIdAndUpdate(orderId, {
    stripeDetails,
    status: CANCELLED,
  });
  res.status(StatusCode.BAD_REQUEST).json(stripeDetails);
}

export const triggerOrderFailEmail = catchAsync(
  async (req: IRequestWithUser, res: Response) => {
    const {
      orderFail: { subject, template, previewText },
    } = EMAILS;
    const email = req.user?.email;
    const orderId = req.params.orderId!;
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
    }
    await sendEmail({
      email: email!,
      subject,
      template,
      context: {
        previewText,
        orderId: order?.orderNumber,
        orderCreatedAt: new Date(order.createdAt).toDateString(),
        products: createProductListForTemplate(order),
        pricingSummary: order.pricingSummary,
        deliveryDate: new Date(order?.delivery?.date).toDateString(),
      },
    });
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: ORDER_FAIL_EMAIL,
    });
  }
);

export const webhookCheckout = (req: Request, res: Response): void => {
  const sig = req.headers['stripe-signature'] || '';
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'payment_intent.payment_failed':
        handlePaymentFailure(event, res);
        break;

      case 'checkout.session.completed':
        updateOrderAfterPaymentSuccess(event, res);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    res.status(StatusCode.BAD_REQUEST).json({
      status: 'fail',
      message: `Webhook Error: ${err.message}`,
    });
  }
};

// Used for GET One - Only allow user to get their respective order
export const authenticateOrderAccess = catchAsync(
  async (req: IRequestWithUser, _: Response, next: NextFunction) => {
    const order = await Order.findById(req.params.id);

    if (
      req.user?.role === Role.CUSTOMER &&
      String(order?.user?._id) !== String(req.user?._id)
    ) {
      return next(new AppError(ORDER_AUTH_ERR, StatusCode.BAD_REQUEST));
    }
    return next();
  }
);

export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const {
    orderConfirm: { subject, template, previewText },
  } = EMAILS;
  const {
    brand,
    delivery: { address },
  } = req?.body;
  const { email, firstName, lastName, phone } = req?.body?.user;

  let user;
  const customer = await User.find({ email });
  [user] = customer;
  if (!customer.length) {
    const userDetails = {
      firstName,
      lastName,
      email,
      phone,
    };
    user = new User(userDetails);
    await user.save({ validateBeforeSave: false });
  }
  req.body.user = user?.id; // IMP for assigning order to this user
  const newAddress = {
    brand,
    user: user?.id,
    ...address,
  };
  const createdAddress = await Address.create(newAddress);
  req.body.delivery.address = createdAddress.id; // Because Order model accepts only object id for address
  req.body.orderNumber = generateOrderId();
  const newOrder = await Order.create(req.body);
  const order = await Order.findById(newOrder?.id).lean();

  await createDelivery(order?._id);
  await sendEmail({
    email: user?.email,
    subject,
    template,
    context: {
      previewText,
      orderId: order?.orderNumber,
      orderCreatedAt: new Date(order!.createdAt).toDateString(),
      products: createProductListForTemplate(order!),
      pricingSummary: order!.pricingSummary,
      deliveryDate: new Date(order!.delivery?.date).toDateString(),
    },
  });
  res.status(StatusCode.CREATE).json({
    status: 'success',
    data: {
      data: order,
    },
  });
});

export const updateOrder = updateOne(Order);
export const deleteOrder = softDeleteOne(Order);
export const deleteManyOrder = softDeleteMany(Order);
export const getOneOrder = getOne(Order);
export const getAllOrder = getAll(Order);
