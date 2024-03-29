import Stripe from 'stripe';
import cron from 'node-cron';
import { Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import Order from '@src/models/orderModel';
import { IRequestWithUser } from './authController';
import { StatusCode } from '@src/types/customTypes';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// cron
function cancelOrder(id: string) {
  const currentTime = new Date();
  const thirtyMinutesAfterCurrentTime = new Date(
    currentTime.getTime() + 30 * 60 * 1000
  );
  const cronScheduleTime = `${thirtyMinutesAfterCurrentTime.getMinutes()} ${thirtyMinutesAfterCurrentTime.getHours()} * * *`;
  cron.schedule(cronScheduleTime, async () => {
    const order = await Order.findById(id);
    if (!order?.paid && order?.orderStatus !== 'cancelled')
      await Order.findByIdAndUpdate(id, { orderStatus: 'cancelled' });
  });
}

export const placeOrder = catchAsync(
  async (req: IRequestWithUser, res: Response) => {
    req.body.user = req.user?._id;
    const order = await Order.create(req.body);
    const populatedOrder = await Order.findById(order.id);
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
      success_url: `https://stg-pinch.netlify.com/order-confirm/${order.id}`, // Need to change URL later
      cancel_url: `https://stg-pinch.netlify.com/checkout`, // Need to change URL later
      mode: 'payment',
      currency: 'sgd',
      line_items: productList,
      metadata: {
        orderId: order.id,
      },
    });

    // Cancel order after 30 mins if payment fails
    cancelOrder(order.id);
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      session,
    });
  }
);

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
    orderStatus: 'cancelled',
  });
  res.status(StatusCode.BAD_REQUEST).json(stripeDetails);
}

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
