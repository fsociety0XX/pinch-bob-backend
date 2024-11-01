/* eslint-disable camelcase */
/* eslint-disable consistent-return */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import Stripe from 'stripe';
import cron from 'node-cron';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongoose';
import catchAsync from '@src/utils/catchAsync';
import Order, { IHitpayDetails, IOrder } from '@src/models/orderModel';
import { IRequestWithUser } from './authController';
import {
  CANCELLED,
  Role,
  StatusCode,
  brandEnum,
  checkoutSessionFor,
} from '@src/types/customTypes';
import sendEmail from '@src/utils/sendEmail';
import {
  getAll,
  getOne,
  softDeleteMany,
  softDeleteOne,
} from '@src/utils/factoryHandler';
import AppError from '@src/utils/appError';
import {
  DELIVERY_CREATE_ERROR,
  PINCH_EMAILS,
  NO_DATA_FOUND,
  ORDER_AUTH_ERR,
  ORDER_NOT_FOUND,
  ORDER_DELIVERY_DATE_ERR,
  ORDER_PREP_EMAIL,
  BOB_EMAILS,
  ORDER_FAIL_EMAIL,
} from '@src/constants/messages';
import { WOODELIVERY_TASK } from '@src/constants/routeConstants';
import {
  calculateBeforeAndAfterDateTime,
  fetchAPI,
  generateOrderId,
  getDateOneDayFromNow,
} from '@src/utils/functions';
import Delivery from '@src/models/deliveryModel';
import User from '@src/models/userModel';
import Address from '@src/models/addressModel';
import Product from '@src/models/productModel';
import Coupon from '@src/models/couponModel';
import { updateCustomiseCakeOrderAfterPaymentSuccess } from './customiseCakeController';
import {
  PRODUCTION,
  SELF_COLLECT_ADDRESS,
  WOODELIVERY_STATUS,
} from '@src/constants/static';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
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
  deliveryDate: Date;
  method: ObjectId | string;
  collectionTime: string;
  recipientName: string | undefined;
  recipientPhone: number | undefined;
  recipientEmail?: string;
  woodeliveryTaskId?: string;
  address?: ObjectId;
}

const sendOrderPrepEmail = async (res: Response) => {
  try {
    const { subject, template, previewText } = PINCH_EMAILS.orderPrepare;
    const targetDate = getDateOneDayFromNow();
    const query = { 'delivery.date': targetDate };

    const ordersToNotify = await Order.find(query);

    if (!ordersToNotify.length) {
      console.log(ORDER_PREP_EMAIL.noOrdersFound);
      return;
    }
    // Prepare email sending promises
    const emailPromises = ordersToNotify.map((order: IOrder) =>
      sendEmail({
        email: order?.user?.email,
        subject,
        template,
        context: {
          previewText,
          orderNo: order?.orderNumber,
          customerName: `${order?.user?.firstName || ''} ${
            order?.user?.lastName || ''
          }`,
        },
      }).catch((error) => {
        console.error(
          ORDER_PREP_EMAIL.emailFailed(order?.orderNumber || ''),
          error
        );
        return { orderNumber: order?.orderNumber, success: false, error };
      })
    );

    await Promise.allSettled(emailPromises);

    // // Log successful and failed email results
    // results.forEach((result, index) => {
    //   if (result.status === 'fulfilled') {
    //     console.log(
    //       `Email sent successfully to order ${ordersToNotify[index].orderNumber}`
    //     );
    //   } else {
    //     console.error(
    //       `Failed to send email to order ${ordersToNotify[index].orderNumber}:`,
    //       result.reason
    //     );
    //   }
    // });

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
    });
    console.log(ORDER_PREP_EMAIL.allTaskCompleted);
  } catch (err) {
    console.error(ORDER_PREP_EMAIL.errorInSendingEmails, err);
  }
};

// Cron scheduled task that runs once a day at midnight
cron.schedule('0 0 * * *', async () => {
  if (process.env.NODE_ENV === PRODUCTION) sendOrderPrepEmail();
});

// Cron scheduled task to run after 30 mins of placing order if the payment failed
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

const prepareCompleteAddress = (order: IOrder) => {
  let completeAddress = '';
  if (order?.delivery?.address?._id) {
    const {
      firstName,
      lastName,
      unitNumber,
      address1,
      address2,
      company,
      city,
      postalCode,
      phone,
    } = order.delivery.address;
    completeAddress = `${firstName} ${lastName}, ${
      unitNumber || ''
    }, ${address1}, ${address2 || ''}, ${
      company || ''
    }, ${city}, ${postalCode}, ${phone}`;
  } else {
    completeAddress = SELF_COLLECT_ADDRESS;
  }
  return completeAddress;
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
    colour: p.colour?.name,
    msg: p?.msg || '',
    fondantName: p?.fondantName || '',
    fondantNumber: p?.fondantNumber || '',
    card: p.card || '',
  }));
  return productList;
};

const sendOrderConfirmationEmail = async (email: string, order: IOrder) => {
  const {
    orderConfirm: { subject, template, previewText },
  } = order.brand === brandEnum[0] ? PINCH_EMAILS : BOB_EMAILS;

  await sendEmail({
    email,
    subject,
    template,
    context: {
      previewText,
      orderId: order?.id,
      orderNo: order?.orderNumber,
      customerName: `${order?.user?.firstName || ''} ${
        order?.user?.lastName || ''
      }`,
      products: createProductListForTemplate(order!),
      pricingSummary: order!.pricingSummary,
      deliveryDate: new Date(order!.delivery?.date)?.toDateString(),
      deliveryMethod: order?.delivery?.method?.name || '',
      collectionTime: order?.delivery?.collectionTime || '',
      address: prepareCompleteAddress(order),
      trackingLink: order?.woodeliveryTaskId
        ? `https://app.woodelivery.com/t?q=${order?.woodeliveryTaskId}`
        : '',
    },
  });
};

const handleStripePayment = async (
  populatedOrder: IOrder,
  req: Request,
  orderId: string
): Stripe.CustomerSession => {
  let productList = [];
  if (populatedOrder!.pricingSummary.coupon?.code) {
    productList = [
      {
        quantity: 1,
        price_data: {
          currency: 'sgd',
          unit_amount: Math.floor(+populatedOrder.pricingSummary.total * 100), // Stripe expects amount in cents
          product_data: {
            name: 'All Products (including discount)',
          },
        },
      },
    ];
  } else {
    productList = populatedOrder?.product.map(
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
  }

  // create checkout session
  const session = await stripe.checkout.sessions.create({
    customer_email: req.user?.email,
    customer: req.user?._id,
    payment_method_types: ['paynow', 'card'],
    success_url: `${req.protocol}://${req.get(
      'host'
    )}/order-confirm/${orderId}`,
    cancel_url: `${req.protocol}://${req.get('host')}/retry-payment/${orderId}`,
    mode: 'payment',
    currency: 'sgd',
    line_items: productList,
    metadata: {
      sessionFor: checkoutSessionFor.website,
      orderId,
    },
  });

  return session;
};

const handleHitpayPayment = async (
  populatedOrder: IOrder,
  req: Request,
  orderId: string,
  next: NextFunction
) => {
  const paymentData = {
    amount: populatedOrder?.pricingSummary?.total,
    currency: 'SGD',
    reference_number: orderId,
    email: populatedOrder?.user?.email || '',
    name: `${populatedOrder.user?.firstName || ''} ${
      populatedOrder?.user?.lastName || ''
    }`,
    phone: populatedOrder?.user?.phone || '',
    send_email: true,
    send_sms: true,
    redirect_url: `${req.protocol}://${req.get(
      'host'
    )}/order-confirm/${orderId}`,
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BUSINESS-API-KEY': process.env.HITPAY_API_KEY,
    },
    body: JSON.stringify(paymentData),
  };
  const response = await fetch(process.env.HITPAY_API_URL, options);

  if (!response.ok) {
    const errorData = await response.json();
    return next(new AppError(errorData, StatusCode.BAD_REQUEST));
  }

  const data = await response.json();
  return data.url; // Return the payment URL
};

export const placeOrder = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    req.body.user = req.user?._id;
    let orderId;
    if (req.body.orderId) {
      orderId = req.body.orderId;
    } else {
      // check if delivery date is not today's date (kept in else block so that it not gets triggered on retry payment)
      const serverTimeUTC = new Date().getTime();
      const clientTimeUTC = new Date(req.body.delivery.date).getTime();
      if (clientTimeUTC < serverTimeUTC) {
        return next(
          new AppError(ORDER_DELIVERY_DATE_ERR, StatusCode.BAD_REQUEST)
        );
      }
      // Updating user document with extra details
      const user = await User.findById(req.user?._id);
      if (!user?.firstName && !user?.lastName && !user?.phone) {
        const { customer } = req.body;
        await User.findByIdAndUpdate(req.user?._id, {
          firstName: customer?.firstName,
          lastName: customer?.lastName,
          phone: customer?.phone,
        });
      }

      const order = await Order.create(req.body);
      orderId = order.id;
    }
    const populatedOrder = await Order.findById(orderId);
    if (!populatedOrder) {
      return next(new AppError(ORDER_NOT_FOUND, StatusCode.BAD_REQUEST));
    }

    let session;
    if (req.body.brand === brandEnum[0]) {
      session = await handleStripePayment(populatedOrder, req, orderId);
    } else {
      session = await handleHitpayPayment(populatedOrder, req, orderId, next);
    }

    // Cancel order after 30 mins if payment fails
    cancelOrder(orderId);
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      session,
    });
  }
);

const createWoodeliveryTask = (order: IOrder, update = false) => {
  const {
    orderNumber,
    delivery: { address, date, collectionTime, instructions },
    recipInfo,
    user,
    brand,
  } = order;

  let taskDesc = '';
  const packages = order.product.map(
    (
      {
        product,
        quantity,
        price,
        size,
        pieces,
        flavour,
        msg,
        fondantName,
        fondantNumber,
      },
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
        field5: `Fondant Name: ${fondantName || ''} and Fondant Number: ${
          fondantNumber || ''
        }`,
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
    tag1: brand,
    packages,
    destinationNotes: instructions || '',
  };
  if (address?.id) {
    task.destinationAddress = `${address.unitNumber || ''} ${
      address.address1
    }, ${address.address2 || ''}, ${address.company || ''}, ${
      address.country
    }, ${address.postalCode}`;
    task.requesterName = `${address.firstName} ${address.lastName}`;
    task.requesterPhone = String(address.phone);
  }
  if (recipInfo?.sameAsSender) {
    task.recipientEmail = user?.email;
  }

  return update
    ? fetchAPI(`${WOODELIVERY_TASK}/${order?.woodeliveryTaskId}`, 'PUT', task)
    : fetchAPI(WOODELIVERY_TASK, 'POST', task);
};

const createDeliveryDocument = async (order: IOrder, task?: Response) => {
  const {
    delivery: { address, method, date, collectionTime },
    recipInfo,
    user,
    brand,
  } = order;
  const data: IDeliveryData = {
    brand,
    order: order?.id,
    deliveryDate: new Date(date),
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
          status: WOODELIVERY_STATUS[task?.data?.statusId],
        });
      })
      .catch((err) => console.error(err, DELIVERY_CREATE_ERROR));
};

async function updateProductSold(order: IOrder) {
  const updates = order.product.map((p) => ({
    updateOne: {
      filter: { _id: p.product._id }, // Filter by product ID
      update: { $inc: { sold: p.quantity } }, // Increment by ordered quantity
    },
  }));
  await Product.bulkWrite(updates); // Perform bulk updates
}

const updateOrderAfterPaymentSuccess = async (
  session: Stripe.CheckoutSessionCompletedEvent,
  res: Response
) => {
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
  ).lean();

  // If customer has applied coupon
  if (
    order!.pricingSummary.coupon &&
    Object.keys(order!.pricingSummary.coupon).length
  ) {
    // Append coupon details in user model when customer apply a coupon successfully
    const user = await User.findById(order?.user?._id);
    if (
      user?.usedCoupons &&
      !user.usedCoupons?.includes(order!.pricingSummary.coupon?._id)
    ) {
      user.usedCoupons!.push(order!.pricingSummary.coupon?._id);
    }
    // Increment the coupon's used count atomically
    await Coupon.updateOne(
      { _id: order?.pricingSummary.coupon?._id },
      { $inc: { used: 1 } }
    );
    await user!.save({ validateBeforeSave: false });
  }

  await updateProductSold(order!);
  await createDelivery(orderId);
  await sendOrderConfirmationEmail(object.customer_email!, order);

  res.status(StatusCode.SUCCESS).send({
    status: 'success',
    message: 'Payment successfull',
  });
};

export const triggerOrderFailEmail = catchAsync(
  async (req: IRequestWithUser, res: Response) => {
    const email = req.user?.email;
    const orderId = req.params.orderId!;
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
    }

    const {
      orderFail: { subject, template, previewText },
    } = order.brand === brandEnum[0] ? PINCH_EMAILS : BOB_EMAILS;

    await sendEmail({
      email: email! || order.user.email,
      subject,
      template,
      context: {
        previewText,
        orderNo: order?.orderNumber,
        customerName: req.user?.firstName,
      },
    });
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: ORDER_FAIL_EMAIL,
    });
  }
);

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

export const stripeWebhookHandler = (req: Request, res: Response): void => {
  const sig = req.headers['stripe-signature'] || '';
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    const sessionMetadata = event.data.object?.metadata || {};
    switch (event.type) {
      case 'payment_intent.payment_failed':
        handlePaymentFailure(event, res);
        break;

      case 'checkout.session.completed':
        // eslint-disable-next-line no-unused-expressions
        sessionMetadata?.sessionFor === checkoutSessionFor.website
          ? updateOrderAfterPaymentSuccess(event, res)
          : updateCustomiseCakeOrderAfterPaymentSuccess(event, res);
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

  // If customer has applied coupon
  if (
    order!.pricingSummary.coupon &&
    Object.keys(order!.pricingSummary.coupon).length
  ) {
    // Append coupon details in user model when customer apply a coupon successfully
    const cUser = await User.findById(order?.user?._id);
    if (
      cUser?.usedCoupons &&
      !cUser.usedCoupons?.includes(order!.pricingSummary.coupon?._id)
    ) {
      cUser.usedCoupons!.push(order!.pricingSummary.coupon?._id);
    }
    // Increment the coupon's used count automically
    await Coupon.updateOne(
      { _id: order?.pricingSummary.coupon?._id },
      { $inc: { used: 1 } }
    );
    await cUser.save({ validateBeforeSave: false });
  }

  await updateProductSold(order);
  await createDelivery(order?._id);
  await sendOrderConfirmationEmail(email, order);

  res.status(StatusCode.CREATE).json({
    status: 'success',
    data: {
      data: order,
    },
  });
});

export const deleteOrder = softDeleteOne(Order);
export const deleteManyOrder = softDeleteMany(Order);
export const getOneOrder = getOne(Order);
export const getAllOrder = getAll(Order, ['orderNumber']);

export const updateOrder = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { delivery, recipInfo } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!order) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    // Updating delivery document
    if (delivery || recipInfo) {
      const deliveryBody = {};
      if (delivery?.date) deliveryBody.deliveryDate = new Date(delivery.date);
      if (delivery?.method) deliveryBody.method = delivery.method;
      if (delivery?.instructions)
        deliveryBody.instructions = delivery.instructions;
      if (delivery?.collectionTime)
        deliveryBody.collectionTime = delivery.collectionTime;
      if (recipInfo?.name) deliveryBody.recipientName = recipInfo.name;
      if (recipInfo?.contact) deliveryBody.recipientPhone = recipInfo.contact;

      await Delivery.findOneAndUpdate({ order: req.params.id }, deliveryBody);
    }

    // Updating task in woodelivery
    await createWoodeliveryTask(order, true);

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: order,
      },
    });
  }
);

// BOB controllers

/**
 * Verifies the HMAC signature sent by HitPay using the Salt.
 * @param {Object} data - The webhook request body.
 * @param {string} hitpaySignature - The HMAC signature sent by HitPay.
 * @returns {boolean} - Returns true if the HMAC signatures match.
 * @author Kush
 */

function verifyHitPayHmac(req: Request, hitpaySignature: string) {
  const sig = Buffer.from(hitpaySignature || '', 'utf8');

  // Calculate HMAC
  const hmac = crypto.createHmac('sha256', process.env.HITPAY_WEBHOOK_SALT);
  const digest = Buffer.from(hmac.update(req.body).digest('hex'), 'utf8');

  return crypto.timingSafeEqual(digest, sig);
}

const updateBobOrderAfterPaymentSuccess = catchAsync(
  async (session, res: Response) => {
    const { id, status, amount, payment_methods, reference_number, email } =
      session;
    const orderId = reference_number;
    const hitpayDetails = {
      status,
      amount,
      paymentMethod: payment_methods,
      paymentRequestId: id,
    };
    const order = await Order.findByIdAndUpdate(
      orderId,
      { hitpayDetails, paid: true },
      { new: true }
    ).lean();
    // If customer has applied coupon
    if (
      order!.pricingSummary.coupon &&
      Object.keys(order!.pricingSummary.coupon).length
    ) {
      // Append coupon details in user model when customer apply a coupon successfully
      const user = await User.findById(order?.user?._id);
      if (
        user?.usedCoupons &&
        !user.usedCoupons?.includes(order!.pricingSummary.coupon?._id)
      ) {
        user.usedCoupons!.push(order!.pricingSummary.coupon?._id);
      }
      // Increment the coupon's used count atomically
      await Coupon.updateOne(
        { _id: order?.pricingSummary.coupon?._id },
        { $inc: { used: 1 } }
      );
      await user!.save({ validateBeforeSave: false });
    }
    await updateProductSold(order!);
    await createDelivery(orderId);
    await sendOrderConfirmationEmail(email, order);
    res.status(StatusCode.SUCCESS).send({
      status: 'success',
      message: 'Payment successfull',
    });
  }
);

const handlePaymentFaliureForBob = catchAsync(
  async (session: IHitpayDetails, res: Response) => {
    const { id, status, amount, payment_methods, reference_number } = session;

    const orderId = reference_number;
    const hitpayDetails = {
      status,
      amount,
      paymentMethod: payment_methods,
      paymentRequestId: id,
    };
    await Order.findByIdAndUpdate(orderId, {
      hitpayDetails,
      status: CANCELLED,
    });
    res.status(StatusCode.BAD_REQUEST).json(hitpayDetails);
  }
);

export const hitpayWebhookHandler = catchAsync(
  async (req: Request, res: Response) => {
    const hitpaySignature = req.headers['hitpay-signature'];
    const parsedBody = JSON.parse(req.body.toString()); // Need to convert raw body to string and then to JS object
    const paymentRequest = parsedBody?.payment_request;
    const { status } = paymentRequest;

    if (verifyHitPayHmac(req, hitpaySignature)) {
      if (status === 'completed') {
        updateBobOrderAfterPaymentSuccess(paymentRequest, res);
        res.status(200).send('Payment successfull');
      } else {
        handlePaymentFaliureForBob(paymentRequest, res);
        res.status(400).send('Payment failed');
      }
    } else {
      res.status(400).send('Invalid HMAC signature');
    }
  }
);
