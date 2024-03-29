/* eslint-disable camelcase */
import Stripe from 'stripe';
import { Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import Order from '@src/models/orderModel';
import { IRequestWithUser } from './authController';
import { StatusCode } from '@src/types/customTypes';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
type StripeCheckoutSessionCompletedEvent = Stripe.CheckoutSessionCompletedEvent;

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
      client_reference_id: order.id,
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
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      session,
    });
  }
);

const updateOrderAfterPaymentSuccess = async (
  session: StripeCheckoutSessionCompletedEvent
) => {
  const orderId = session.data.object?.metadata;
  const {
    id,
    created,
    data: { object },
  } = session;

  const stripeDetails = {
    eventId: id,
    created,
    checkoutSessionId: object?.id,
    amount: object?.amount_total,
    paymentIntent: object?.payment_intent,
    paymentStatus: object?.payment_status,
    transactionStatus: object?.status,
  };
  await Order.findByIdAndUpdate(orderId, { stripeDetails, paid: true });
};

export const webhookCheckout = (req: Request, res: Response): void => {
  const sig = req.headers['stripe-signature'] || '';
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    if (event?.type === 'checkout.session.completed') {
      // payment is successfull
      updateOrderAfterPaymentSuccess(event!);
      res.status(StatusCode.SUCCESS).send({
        status: 'success',
        message: 'Payment successfull',
      });
    } else {
      // payment is unsuccessfull
      res.status(StatusCode.BAD_REQUEST).send({
        status: 'fail',
        message: 'Payment unsuccessfull',
      });
    }
  } catch (err) {
    res.status(StatusCode.BAD_REQUEST).json({
      status: 'fail',
      message: 'Error in webhook payment processing',
    });
  }
};
