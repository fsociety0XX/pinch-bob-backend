import Stripe from 'stripe';
import { Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import Order from '@src/models/orderModel';
import { IRequestWithUser } from './authController';
import { StatusCode } from '@src/types/customTypes';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
type StripeWebhookEvent = Stripe.Event;

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
      success_url: `https://stg-pinch.netlify.com/order-confirm`, // Need to change URL later
      cancel_url: `https://stg-pinch.netlify.com/checkout`, // Need to change URL later
      mode: 'payment',
      currency: 'sgd',
      line_items: productList,
    });
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      session,
    });
  }
);

const updateOrder = async (session: StripeWebhookEvent, payment: string) => {
  // const orderId = session.data.object;
  console.log(session, payment, 'session after payment success');
};

export const webhookCheckout = (req: Request, res: Response): void => {
  const sig = req.headers['stripe-signature'] || '';
  let event: StripeWebhookEvent;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    if (event?.type === 'checkout.session.completed') {
      // payment is successfull
      updateOrder(event, 'success');
      res.status(StatusCode.SUCCESS).send({
        status: 'success',
        message: 'Payment successfull',
      });
    } else {
      // payment is unsuccessfull
      updateOrder(event!, 'fail');
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
