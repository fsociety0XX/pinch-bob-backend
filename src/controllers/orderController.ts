import Stripe from 'stripe';
import cron from 'node-cron';
import { Request, Response, NextFunction } from 'express';
import catchAsync from '@src/utils/catchAsync';
import Order, { IOrder } from '@src/models/orderModel';
import { IRequestWithUser } from './authController';
import { Role, StatusCode } from '@src/types/customTypes';
import sendEmail from '@src/utils/sendEmail';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';
import AppError from '@src/utils/appError';
import { ORDER_AUTH_ERR } from '@src/constants/messages';
import { CREATE_WOODELIVERY_TASK } from '@src/constants/routeConstants';
import { fetchAPI } from '@src/utils/functions';
import Delivery from '@src/models/deliveryModel';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const CANCELLED = 'cancelled';

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
  async (req: IRequestWithUser, res: Response) => {
    req.body.user = req.user?._id;
    let orderId;
    if (req.body.orderId) {
      orderId = req.body.orderId;
    } else {
      const order = await Order.create(req.body);
      orderId = order.id;
    }
    const populatedOrder = await Order.findById(orderId);
    const productList = populatedOrder?.product.map(
      ({ product, price, quantity }) => ({
        quantity,
        price_data: {
          currency: 'sgd',
          unit_amount: price * 100,
          product_data: {
            name: product.name,
            images: [product?.images?.[0]?.location],
          },
        },
      })
    );

    // create checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: req.user?.email,
      customer: req.user?._id,
      payment_method_types: ['paynow', 'card'],
      success_url: `https://stg-pinch.netlify.com/order-confirm/${orderId}`, // Need to change URL later
      cancel_url: `https://stg-pinch.netlify.com/checkout/${orderId}`, // Need to change URL later
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
  const selfCollectDeliveryMethodId = '65e6bed4e40a1c39bc88b706';
  const {
    delivery: { address, method, date },
  } = order;
  const destinationAddress = `${address.address1}, ${address.address2 || ''}, ${
    address.company || ''
  }, ${address.city}, ${address.country}, ${address.postalCode}`;
  const taskTypeId =
    String(method.id) === String(selfCollectDeliveryMethodId) ? 5 : 1;
  let taskDesc = '';
  const packages = order.product.map(
    (
      { product, quantity, price, size, pieces, flavour, msg, fondantInfo },
      index
    ) => {
      taskDesc += `${index ? ', ' : ''}${quantity} x ${product.name}`;
      return {
        productId: product.id,
        orderId: order.id,
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
  const task = {
    taskTypeId,
    taskDesc,
    externalKey: order.id,
    // afterDateTime: '2024-04-03T10:27:49.401Z',
    beforeDateTime: new Date(date).toISOString(), // UTC
    requesterName: `${address.firstName} ${address.lastName}`,
    requesterPhone: String(address.phone),
    destinationAddress,
    recipientName: order.recipInfo?.name,
    recipientPhone: String(order.recipInfo?.contact),
    tag1: 'pinch',
    packages,
  };

  return fetchAPI(CREATE_WOODELIVERY_TASK, 'POST', task);
};

const createDelivery = async (id: string) => {
  const order = await Order.findById(id);
  const {
    delivery: { address, method, date, collectionTime },
    recipInfo,
  } = order!;
  createWoodeliveryTask(order!)
    .then(async (response) => {
      const task = await response.json();
      const data = {
        brand: 'pinch', // TODO: change when rewriting bob
        order: order?.id,
        deliveryDate: date,
        method: method.id,
        collectionTime,
        address: address.id,
        recipientEmail: recipInfo?.name,
        recipientPhone: recipInfo?.contact,
        woodeliveryTaskId: task.data.guid,
      };
      await Delivery.create(data);
      await Order.findByIdAndUpdate(id, { woodeliveryTaskId: task.data.guid });
    })
    .catch((err) => console.error(err, 'Error in creating delivery'));
};

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
  await Order.findByIdAndUpdate(orderId, { stripeDetails, paid: true });
  await createDelivery(orderId);
  // TODO: change email later
  await sendEmail({
    email: object.customer_email!,
    subject: `Congratulations! for you order ${orderId}`,
    message: 'You order has been placed successfully',
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
    const email = req.user?.email;
    const orderId = req.params.orderId!;
    // TODO: change email later
    await sendEmail({
      email: email!,
      subject: `Payment failed for your recent order ${orderId}`,
      message: `We have placed your order but payment didn't succeed. You can retry payment within 20 minutes to avoid order cancellation.`,
    });
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: 'Order failure email sent successfully.',
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

export const createOrder = createOne(Order);
export const updateOrder = updateOne(Order);
export const deleteOrder = deleteOne(Order);
export const getOneOrder = getOne(Order);
export const getAllOrder = getAll(Order);
