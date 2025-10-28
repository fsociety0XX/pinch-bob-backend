/* eslint-disable radix */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
/* eslint-disable prefer-destructuring */
/* eslint-disable camelcase */
/* eslint-disable consistent-return */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import Stripe from 'stripe';
import cron from 'node-cron';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import mongoose, { ObjectId } from 'mongoose';
import catchAsync from '@src/utils/catchAsync';
import Order, { IHitpayDetails, IOrder } from '@src/models/orderModel';
import { IRequestWithUser } from './authController';
import {
  CANCELLED,
  HITPAY_PAYMENT_PURPOSE,
  Role,
  SELF_COLLECT,
  StatusCode,
  brandEnum,
  checkoutSessionFor,
  inventoryEnum,
} from '@src/types/customTypes';
import sendEmail from '@src/utils/sendEmail';
import { getAll, getOne } from '@src/utils/factoryHandler';
import AppError from '@src/utils/appError';
import {
  PINCH_EMAILS,
  NO_DATA_FOUND,
  ORDER_AUTH_ERR,
  ORDER_NOT_FOUND,
  ORDER_DELIVERY_DATE_ERR,
  BOB_EMAILS,
  ORDER_FAIL_EMAIL,
  REF_IMG_UPDATE,
} from '@src/constants/messages';
import { WOODELIVERY_TASK } from '@src/constants/routeConstants';
import {
  calculateBeforeAndAfterDateTime,
  fetchAPI,
  generateUniqueIds,
  generateUniqueOrderNumber,
  toUtcDateOnly,
} from '@src/utils/functions';
import { normalizeImagesToCdn } from '@src/utils/cdn';
import Delivery from '@src/models/deliveryModel';
import User from '@src/models/userModel';
import Address from '@src/models/addressModel';
import Product from '@src/models/productModel';
import Coupon from '@src/models/couponModel';
import { updateCustomiseCakeOrderAfterPaymentSuccess } from './customiseCakeController';
import {
  BOB_EMAIL_DETAILS,
  SELF_COLLECT_ADDRESS,
  WOODELIVERY_STATUS,
} from '@src/constants/static';
import DeliveryMethod from '@src/models/deliveryMethodModel';
import logActivity, { ActivityActions } from '@src/utils/activityLogger';

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
  orderNumber: string;
  order: string;
  deliveryDate: Date;
  method: ObjectId | string;
  collectionTime: string;
  recipientName: string | undefined;
  recipientPhone: number | undefined;
  recipientEmail?: string;
  woodeliveryTaskId?: string;
  address?: ObjectId;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  status?: string;
  paid: boolean;
  driverDetails?: {
    id: string;
    name: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  } | null;
}

// CRON scheduled task to run after 30 mins of placing order if the payment failed
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

// const sendPurchaseEventToGA4 = catchAsync(async (id: string) => {
//   const API_URL = `${GA_URL}?measurement_id=${process.env.GMEASUREMENT_ID}&api_secret=${process.env.GA_SECRET}`;
//   const order = await Order.findById(id);
//   if (!order) {
//     return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
//   }

//   const payload = {
//     client_id: order?.gaClientId || order?.user?._id,
//     events: [
//       {
//         name: 'purchase',
//         params: {
//           currency: 'SGD',
//           transaction_id: order?.orderNumber,
//           value:
//             (+order?.pricingSummary?.subTotal ?? 0) -
//             (+order?.pricingSummary?.discountedAmt ?? 0),
//           coupon: order?.pricingSummary?.coupon?.code || '',
//           shipping: +order?.pricingSummary?.deliveryCharge,
//           items: order?.product?.map((p) => ({
//             item_id: p?.product?.id,
//             item_name: p?.product?.name,
//             price: p?.price,
//             quantity: p?.quantity,
//           })),
//         },
//       },
//     ],
//   };

//   await fetch(API_URL, {
//     method: 'POST',
//     body: JSON.stringify(payload),
//   });
// });

const prepareCompleteAddress = (order: IOrder) => {
  let completeAddress = '';
  const isSelfCollect = order?.delivery?.method?.name === SELF_COLLECT;

  if (isSelfCollect) {
    completeAddress = SELF_COLLECT_ADDRESS;
  } else {
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
  // Pinch
  if (order.brand === brandEnum[0]) {
    const { subject, template, previewText } = PINCH_EMAILS.orderConfirm;

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
      brand: order.brand,
    });
  }

  // Bob
  if (order.brand === brandEnum[1]) {
    const { subject, template, previewText } = BOB_EMAILS.orderConfirm;

    await sendEmail({
      email,
      subject,
      template,
      context: {
        previewText,
        homeUrl: BOB_EMAIL_DETAILS.homeUrl,
        customerName: `${order?.user?.firstName || ''} ${
          order?.user?.lastName || ''
        }`,
        orderNo: order?.orderNumber,
        products: createProductListForTemplate(order!),
        subTotal: order.pricingSummary.subTotal || 0,
        discount: order.pricingSummary.discountedAmt || 0,
        deliveryCharge: order.pricingSummary.deliveryCharge || 0,
        total: order.pricingSummary.total || 0,
        deliveryDate: new Date(order!.delivery?.date)?.toDateString(),
        deliveryMethod: order?.delivery?.method?.name || '',
        collectionTime: order?.delivery?.collectionTime || '',
        address: prepareCompleteAddress(order),
        trackingLink: order?.woodeliveryTaskId
          ? `https://app.woodelivery.com/t?q=${order?.woodeliveryTaskId}`
          : '',
        faqLink: BOB_EMAIL_DETAILS.faqLink,
        whatsappLink: BOB_EMAIL_DETAILS.whatsappLink,
      },
      brand: order.brand,
    });
  }
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
    purpose: HITPAY_PAYMENT_PURPOSE[0],
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
      let user = await User.findById(req.user?._id);
      if (
        !user?.firstName ||
        user?.firstName === 'Guest' ||
        !user?.lastName ||
        user?.lastName === 'User' ||
        !user?.email
      ) {
        const { customer } = req.body;

        // Prepare update data - only update fields that don't conflict with existing users
        const updateData = {
          firstName: customer?.firstName,
          lastName: customer?.lastName,
          userId: user?.userId || generateUniqueIds(),
        };

        // Handle email update carefully
        if (customer?.email && customer.email !== user?.email) {
          // Check if customer email is available (excluding current user)
          const existingUserWithEmail = await User.findOne({
            email: customer.email,
            brand: req.body.brand,
            _id: { $ne: user._id }, // Exclude current user
          });

          if (!existingUserWithEmail) {
            updateData.email = customer.email;
          } else {
            // Email conflicts with another user - keep existing email
            updateData.email = user?.email;
          }
        } else {
          // No email provided or same email - keep existing
          updateData.email = user?.email;
        }

        // Handle phone update carefully
        if (customer?.phone && customer.phone !== user?.phone) {
          // Check if customer phone is available (excluding current user)
          const existingUserWithPhone = await User.findOne({
            phone: customer.phone,
            brand: req.body.brand,
            _id: { $ne: user._id }, // Exclude current user
          });

          if (!existingUserWithPhone) {
            updateData.phone = customer.phone;
          } else {
            // Phone conflicts with another user - keep existing phone
            updateData.phone = user?.phone;
          }
        } else {
          // No phone provided or same phone - keep existing
          updateData.phone = user?.phone;
        }

        try {
          user = await User.findByIdAndUpdate(req.user?._id, updateData, {
            new: true,
          });
        } catch (updateError) {
          // If update still fails, proceed with existing user data
          console.log(
            'User update failed during order placement:',
            updateError
          );
          // user remains unchanged, order can still proceed
        }
      }
      req.body.delivery.date = toUtcDateOnly(req.body.delivery.date);
      req.body.customer = {
        firstName: user?.firstName,
        lastName: user?.lastName,
        email: user?.email,
        phone: user?.phone,
      };
      // Generate unique order number for the brand
      req.body.orderNumber = await generateUniqueOrderNumber(req.body.brand);
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
  const packages = order?.corporate
    ? []
    : order.product.map(
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
  if (packages.length) {
    task.packages = packages;
  }
  if (order?.woodeliveryTaskId) {
    task.taskGuid = order?.woodeliveryTaskId;
  }

  return update
    ? fetchAPI(`${WOODELIVERY_TASK}/${order?.woodeliveryTaskId}`, 'PUT', task)
    : fetchAPI(WOODELIVERY_TASK, 'POST', task);
};

const createDeliveryDocument = async (
  order: IOrder,
  task?: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update = false
) => {
  try {
    const {
      delivery: { address, method, date, collectionTime },
      recipInfo,
      user,
      brand,
    } = order;

    const data: IDeliveryData = {
      brand,
      order: order._id.toString(),
      orderNumber: order.orderNumber,
      deliveryDate: new Date(date),
      method: method._id || method.id,
      collectionTime,
      recipientName: recipInfo?.name,
      recipientPhone: recipInfo?.contact,
      customer: {
        firstName: user?.firstName,
        lastName: user?.lastName,
        email: user?.email || '',
        phone: user?.phone || '',
      },
      paid: order.paid || false, // Ensure paid status is set
    };

    // Check if delivery method is self-collect to unassign driver
    const deliveryMethod = await DeliveryMethod.findById(
      method._id || method.id
    );
    if (deliveryMethod?.name === SELF_COLLECT) {
      data.driverDetails = null; // Unassign driver for self-collect
    } else if (order.driverDetails) {
      data.driverDetails = order.driverDetails; // Keep existing driver for delivery orders
    }

    if (task) {
      data.woodeliveryTaskId = task?.data?.guid;
      data.status = WOODELIVERY_STATUS[task?.data?.statusId];
    }

    if (address?._id || address?.id) {
      data.address = address._id || address.id;
    }

    if (!recipInfo || recipInfo?.sameAsSender) {
      data.recipientEmail = user?.email;
    }

    // ✅ Always use upsert to prevent duplicates
    const result = await Delivery.findOneAndUpdate(
      { order: order._id }, // Filter by order ID
      data, // Update data
      {
        new: true,
        upsert: true, // Creates if doesn't exist, updates if exists
        setDefaultsOnInsert: true,
      }
    );

    return result;
  } catch (error) {
    console.error('💥 Error in createDeliveryDocument:', error);

    // ✅ Handle duplicate key errors gracefully
    if (error.code === 11000) {
      const existing = await Delivery.findOne({ order: order._id });
      if (existing) {
        return existing;
      }
    }

    throw error;
  }
};

const createDelivery = async (id: string, update = false) => {
  const order = await Order.findById(id);
  if (!order) {
    return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
  }

  // ✅ Check if delivery already exists and prevent duplicates
  const existingDelivery = await Delivery.findOne({ order: id });
  if (existingDelivery && !update) {
    return existingDelivery;
  }

  const {
    brand,
    delivery: { method },
  } = order;

  const selfCollectDetails = await DeliveryMethod.findOne({
    name: SELF_COLLECT,
    brand,
  });

  const isSelfCollect =
    String(method._id || method.id) ===
    String(selfCollectDetails?.id || selfCollectDetails?._id);

  try {
    if (isSelfCollect) {
      const result = await createDeliveryDocument(
        order,
        undefined,
        update || !!existingDelivery
      );
      return result;
    }

    // ✅ Fixed logic: Only create new task if order doesn't have woodeliveryTaskId
    // For updates, use existing task ID to update the task
    if (!order.woodeliveryTaskId) {
      const response = await createWoodeliveryTask(order, false);
      const task = await response.json();

      const deliveryResult = await createDeliveryDocument(
        order,
        task,
        !!existingDelivery
      );

      // Update order with new task ID
      await Order.findByIdAndUpdate(id, {
        woodeliveryTaskId: task.data.guid,
        status: WOODELIVERY_STATUS[task?.data?.statusId],
      });

      return deliveryResult;
    }

    if (update) {
      const response = await createWoodeliveryTask(order, true);
      const task = await response.json();

      const deliveryResult = await createDeliveryDocument(order, task, true);

      // Update order status if needed
      if (task?.data?.statusId) {
        await Order.findByIdAndUpdate(id, {
          status: WOODELIVERY_STATUS[task.data.statusId],
        });
      }

      return deliveryResult;
    }

    const deliveryResult = await createDeliveryDocument(order, undefined, true);
    return deliveryResult;
  } catch (error) {
    console.error('💥 Error in createDelivery:', error);
    throw error;
  }
};
const getInventoryStatus = (remainingQty: number): string => {
  if (remainingQty === 0) return inventoryEnum[0]; // "Out of stock"
  if (remainingQty <= 20) return inventoryEnum[1]; // "Low stock"
  return inventoryEnum[2]; // "In stock"
};

async function updateProductAfterPurchase(orderId: string) {
  const order = await Order.findById(orderId).populate('product.product');

  if (!order) {
    return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
  }

  // Process each product individually
  for (let i = 0; i < order.product.length; i += 1) {
    const p = order.product[i];

    try {
      const { inventory } = p?.product;

      if (inventory && inventory.track) {
        const updatedRemQty = Math.max(0, inventory.remainingQty - p.quantity);
        const isProductAvailable = updatedRemQty > 0;
        const inventoryStatus = getInventoryStatus(updatedRemQty);

        await Product.findByIdAndUpdate(
          p.product._id,
          {
            $inc: { sold: p.quantity },
            $set: {
              'inventory.remainingQty': updatedRemQty,
              'inventory.status': inventoryStatus,
              maxQty: updatedRemQty,
              available: isProductAvailable,
            },
          },
          { new: true }
        );
      } else {
        // For products not tracking inventory, just increment sold count
        await Product.findByIdAndUpdate(
          p.product._id,
          {
            $inc: { sold: p.quantity },
          },
          { new: true }
        );
      }
    } catch (error) {
      console.error(`Error updating product ${i}:`, error);
      // Continue with other products even if one fails
    }
  }
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
  if (order!.pricingSummary.coupon?._id) {
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
      { _id: order?.pricingSummary?.coupon?._id },
      { $inc: { used: 1 } }
    );
    await user!.save({ validateBeforeSave: false });
  }

  await updateProductAfterPurchase(orderId);
  await createDelivery(orderId);
  await sendOrderConfirmationEmail(object.customer_email!, order);
  // await sendPurchaseEventToGA4(orderId);

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

    // Pinch
    if (order.brand === brandEnum[0]) {
      const { subject, template, previewText } = PINCH_EMAILS.orderFail;

      await sendEmail({
        email: email! || order.user.email,
        subject,
        template,
        context: {
          previewText,
          orderNo: order?.orderNumber,
          customerName: req.user?.firstName,
        },
        brand: order.brand,
      });
    }

    // Bob
    if (order.brand === brandEnum[1]) {
      const { subject, template, previewText } = BOB_EMAILS.orderFail;

      await sendEmail({
        email: email! || order.user.email,
        subject,
        template,
        context: {
          previewText,
          orderNo: order?.orderNumber,
          customerName: req.user?.firstName,
          homeUrl: BOB_EMAIL_DETAILS.homeUrl,
          loginLink: BOB_EMAIL_DETAILS.loginLink,
          faqLink: BOB_EMAIL_DETAILS.faqLink,
          whatsappLink: BOB_EMAIL_DETAILS.whatsappLink,
        },
        brand: order.brand,
      });
    }

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
    // const sessionMetadata = event.data.object?.metadata || {};
    switch (event.type) {
      case 'payment_intent.payment_failed':
        handlePaymentFailure(event, res);
        break;

      case 'checkout.session.completed':
        updateOrderAfterPaymentSuccess(event, res);
        // eslint-disable-next-line no-unused-expressions
        // sessionMetadata?.sessionFor === checkoutSessionFor.website
        //   ? updateOrderAfterPaymentSuccess(event, res)
        //   : updateCustomiseCakeOrderAfterPaymentSuccess(event, res);
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

// Used for GET One and Update - Only allow user to get or update their respective order
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
    delivery: { address, date },
  } = req?.body;
  const { email, firstName, lastName, phone } = req?.body?.user;

  // Sanitize product array fields to prevent casting errors
  if (req.body.product && Array.isArray(req.body.product)) {
    req.body.product = req.body.product.map((productItem: any) => {
      if (productItem.size === '' || productItem.size === undefined) {
        productItem.size = null;
      }
      if (productItem.flavour === '' || productItem.flavour === undefined) {
        productItem.flavour = null;
      }
      if (productItem.pieces === '' || productItem.pieces === undefined) {
        productItem.pieces = null;
      }
      if (productItem.colour === '' || productItem.colour === undefined) {
        productItem.colour = null;
      }
      return productItem;
    });
  }

  let user;
  let customer = await User.find({ email });
  [user] = customer;
  if (!customer.length) {
    const userDetails = {
      firstName,
      lastName,
      email,
      phone,
    };
    user = new User(userDetails);
    customer = await user.save({ validateBeforeSave: false });
  }
  req.body.user = user?.id; // IMP for assigning order to this user
  const newAddress = {
    brand,
    user: user?.id,
    ...address,
  };
  const createdAddress = await Address.create(newAddress);
  req.body.delivery.address = createdAddress.id; // Because Order model accepts only object id for address
  req.body.orderNumber = await generateUniqueOrderNumber(brand);
  req.body.delivery.date = toUtcDateOnly(date);
  req.body.customer = {
    firstName: customer?.firstName,
    lastName: customer?.lastName,
    email: customer?.email,
    phone: customer?.phone,
  };
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

  await updateProductAfterPurchase(order?._id);
  await createDelivery(order?._id);
  await sendOrderConfirmationEmail(email, order);

  res.status(StatusCode.CREATE).json({
    status: 'success',
    data: {
      data: order,
    },
  });
});

export const bulkCreateOrders = catchAsync(
  async (req: Request, res: Response) => {
    const ordersData = req.body.orders; // Expect an array of orders from Excel
    const createdOrders = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const orderData of ordersData) {
      const {
        brand,
        delivery: { address, date },
        user: userData,
        senderDetails,
      } = orderData;

      // Find or create user - check both email and phone to avoid conflicts
      let user = await User.findOne({ email: userData.email, brand });
      if (!user) {
        // Check if phone number already exists for this brand
        if (userData.phone) {
          const existingUserWithPhone = await User.findOne({
            phone: userData.phone,
            brand,
          });
          if (existingUserWithPhone) {
            // Phone number already exists, use the existing user
            user = existingUserWithPhone;
            // Update the existing user with new email if different
            if (existingUserWithPhone.email !== userData.email) {
              try {
                user = await User.findByIdAndUpdate(
                  existingUserWithPhone._id,
                  { email: userData.email, ...userData },
                  { new: true }
                );
              } catch (updateError) {
                // If update fails due to email conflict, just use the existing user
                console.log(
                  'Email update failed, using existing user:',
                  updateError
                );
                user = existingUserWithPhone;
              }
            }
          } else {
            // Phone number doesn't exist, create new user
            try {
              user = new User({ brand, ...userData });
              await user.save({ validateBeforeSave: false });
            } catch (createError) {
              // If creation fails, try to find user by phone one more time
              // (race condition handling)
              console.log(
                'User creation failed, checking for existing user:',
                createError
              );
              user =
                (await User.findOne({ phone: userData.phone, brand })) ||
                (await User.findOne({ email: userData.email, brand }));
              if (!user) {
                throw createError; // Re-throw if we still can't find a user
              }
            }
          }
        } else {
          // No phone number provided, create new user
          try {
            user = new User({ brand, ...userData });
            await user.save({ validateBeforeSave: false });
          } catch (createError) {
            // If creation fails, try to find user by email one more time
            console.log(
              'User creation failed, checking for existing user:',
              createError
            );
            user = await User.findOne({ email: userData.email, brand });
            if (!user) {
              throw createError; // Re-throw if we still can't find a user
            }
          }
        }
      }
      orderData.user = user._id;

      // Create address
      const newAddress = { brand, user: user._id, ...address };
      const createdAddress = await Address.create(newAddress);
      orderData.delivery.address = createdAddress._id;
      orderData.delivery.date = toUtcDateOnly(date);
      orderData.customer = {
        firstName: senderDetails?.name || user?.firstName,
        lastName: senderDetails?.name ? '.' : user?.lastName,
        email: senderDetails?.email || user?.email,
        phone: senderDetails?.phone || user?.phone,
      };
      // Generate order number and create order
      orderData.orderNumber = await generateUniqueOrderNumber(orderData.brand);
      const newOrder = await Order.create(orderData);
      const order = await Order.findById(newOrder?.id).lean();

      // Handle coupons
      // if (order?.pricingSummary?.coupon) {
      //   const cUser = await User.findById(order.user);
      //   const couponId = order.pricingSummary.coupon._id;

      //   if (cUser && !cUser.usedCoupons?.includes(couponId)) {
      //     cUser.usedCoupons.push(couponId);
      //     await Coupon.updateOne({ _id: couponId }, { $inc: { used: 1 } });
      //     await cUser.save({ validateBeforeSave: false });
      //   }
      // }

      // await updateProductAfterPurchase(order._id);
      await createDelivery(order._id);

      // Send confirmation email only if we have a valid email
      const emailToSend =
        userData.email || order.customer?.email || order.user?.email;
      if (emailToSend && emailToSend.trim() && emailToSend.includes('@')) {
        try {
          await sendOrderConfirmationEmail(emailToSend.trim(), order);
        } catch (emailError) {
          console.error(`Failed to send email to ${emailToSend}:`, emailError);
          // Don't fail the entire operation if email fails
        }
      } else {
        console.warn(
          `No valid email found for order ${order.orderNumber}. Skipping email.`
        );
      }

      createdOrders.push(order);
    }

    res.status(StatusCode.CREATE).json({
      status: 'success',
      data: {
        data: createdOrders,
      },
    });
  }
);

export const deleteOrder = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const orderId = req.params.id;

    // Update the order status to cancelled
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        status: CANCELLED,
        active: false,
      },
      { new: true }
    );

    if (!order) {
      return next(
        new AppError('No order found with that ID', StatusCode.NOT_FOUND)
      );
    }

    // Update the corresponding delivery status
    await Delivery.findOneAndUpdate(
      { orderNumber: order.orderNumber },
      {
        status: CANCELLED,
        active: false,
      },
      { new: true }
    );

    // Log the activity (same as softDeleteOne does)
    await logActivity({
      user: {
        _id: req.user._id,
        firstName: req.user?.firstName || '',
        lastName: req.user?.lastName || '',
        email: req.user?.email || '',
      },
      action: ActivityActions.DELETE_ORDER,
      module: 'order',
      targetId: order._id.toString(),
      metadata: {
        orderNumber: order.orderNumber,
        cancelled: true,
      },
      brand: req.brand,
    });

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: 'Order cancelled successfully',
      data: {
        data: order,
      },
    });
  }
);

export const deleteManyOrder = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return next(
        new AppError('Please provide valid order IDs', StatusCode.BAD_REQUEST)
      );
    }

    // Update multiple orders to cancelled status
    const result = await Order.updateMany(
      { _id: { $in: ids } },
      {
        status: CANCELLED,
        active: false,
      }
    );

    // Get the order numbers for the cancelled orders
    const cancelledOrders = await Order.find(
      { _id: { $in: ids } },
      { orderNumber: 1 }
    );
    const orderNumbers = cancelledOrders.map((order) => order.orderNumber);

    // Update corresponding deliveries using order numbers
    await Delivery.updateMany(
      { orderNumber: { $in: orderNumbers } },
      {
        status: CANCELLED,
        active: false,
      }
    );

    // Log activity for bulk cancellation
    await logActivity({
      user: {
        _id: req.user._id,
        firstName: req.user?.firstName || '',
        lastName: req.user?.lastName || '',
        email: req.user?.email || '',
      },
      action: ActivityActions.DELETE_ORDER,
      module: 'order',
      targetId: 'bulk',
      metadata: {
        cancelledOrderIds: ids,
        cancelledCount: result.modifiedCount,
      },
      brand: req.brand,
    });

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: `${result.modifiedCount} orders cancelled successfully`,
      data: {
        modifiedCount: result.modifiedCount,
        cancelledIds: ids,
      },
    });
  }
);

export const getOneOrder = getOne(Order);

export const getAllOrder = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      orderNumber,
      superCategory,
      category,
      subCategory,
      flavour,
      // tag,
      moneyPullingOrders,
      deliveryStartDate,
      deliveryEndDate,
      dateMode,
      dateFrom,
      dateTo,
      driverId,
      status,
      paid,
      active,
    } = req.query;

    const timeRange =
      dateFrom && dateTo
        ? {
            gte: new Date(dateFrom as string),
            lte: new Date(dateTo as string),
          }
        : undefined;

    const filter: any = {};
    const baseConditions = []; // For conditions that should be ANDed together

    if (timeRange) {
      if (dateMode === 'created') {
        filter.createdAt = timeRange;
      } else if (dateMode === 'updated') {
        filter.updatedAt = timeRange;
      } else if (dateMode === 'both') {
        // Store this for later combination with other $or conditions
        baseConditions.push({
          $or: [{ createdAt: timeRange }, { updatedAt: timeRange }],
        });
      }
    }

    if (orderNumber) {
      filter.orderNumber = {
        $in: (orderNumber as string).split(','),
      };
    }

    // STABLE FILTER LOGIC - Accumulate all $or conditions without mutation
    const allOrConditions = []; // Array to hold all $or condition groups

    // PARALLEL PRODUCT QUERIES - Execute all Product.find() in parallel to avoid race conditions
    const [superProducts, categoryProducts, subCategoryProducts] =
      await Promise.all([
        superCategory
          ? Product.find({
              superCategory: { $in: (superCategory as string).split(',') },
            })
          : Promise.resolve([]),
        category
          ? Product.find({
              category: { $in: (category as string).split(',') },
            })
          : Promise.resolve([]),
        subCategory
          ? Product.find({
              subCategory: { $in: (subCategory as string).split(',') },
            })
          : Promise.resolve([]),
      ]);

    // Collect category filter conditions
    const categoryOrConditions = [];

    if (superCategory) {
      const superCategoryIds = (superCategory as string).split(',');
      const productIds = superProducts.map((product) => product._id);

      // Add conditions for regular products, otherProduct, and customFormProduct with matching superCategory
      // Always add direct category conditions, even if no products found (for otherProduct and customFormProduct)
      categoryOrConditions.push(
        { 'otherProduct.superCategory': { $in: superCategoryIds } },
        { 'customFormProduct.superCategory': { $in: superCategoryIds } }
      );

      // Only add product-based conditions if products exist
      if (productIds.length > 0) {
        categoryOrConditions.push(
          { 'product.product': { $in: productIds } },
          { 'customFormProduct.product': { $in: productIds } }
        );
      }
    }
    if (category) {
      const categoryIds = (category as string).split(',');
      const productIds = categoryProducts.map((product) => product._id);

      // Add conditions for regular products, otherProduct, and customFormProduct with matching category
      // Always add direct category conditions, even if no products found
      categoryOrConditions.push(
        { 'otherProduct.category': { $in: categoryIds } },
        { 'customFormProduct.category': { $in: categoryIds } }
      );

      // Only add product-based conditions if products exist
      if (productIds.length > 0) {
        categoryOrConditions.push(
          { 'product.product': { $in: productIds } },
          { 'customFormProduct.product': { $in: productIds } }
        );
      }
    }
    if (subCategory) {
      const subCategoryIds = (subCategory as string).split(',');
      const productIds = subCategoryProducts.map((product) => product._id);

      // Add conditions for regular products, otherProduct, and customFormProduct with matching subCategory
      // Always add direct category conditions, even if no products found
      categoryOrConditions.push(
        { 'otherProduct.subCategory': { $in: subCategoryIds } },
        { 'customFormProduct.subCategory': { $in: subCategoryIds } }
      );

      // Only add product-based conditions if products exist
      if (productIds.length > 0) {
        categoryOrConditions.push(
          { 'product.product': { $in: productIds } },
          { 'customFormProduct.product': { $in: productIds } }
        );
      }
    }

    // Add category conditions to allOrConditions if any exist
    if (categoryOrConditions.length > 0) {
      allOrConditions.push({ $or: categoryOrConditions });
    }

    // Handle flavour filter
    if (flavour) {
      const flavourConditions = [
        { 'product.flavour': { $in: (flavour as string).split(',') } },
        {
          'customFormProduct.flavour': { $in: (flavour as string).split(',') },
        },
        // Note: otherProduct.flavour is a string field, not ObjectId, so we need to handle it differently
        // For now, we'll skip otherProduct.flavour as it would require flavour name matching instead of ID matching
      ];
      allOrConditions.push({ $or: flavourConditions });
    }

    // Handle moneyPulling filter
    if (moneyPullingOrders) {
      // Check for both isMoneyPulling at order level AND wantMoneyPulling in product array
      const moneyPullingValue =
        moneyPullingOrders === 'true' || moneyPullingOrders === true;

      const moneyPullingConditions = [
        { isMoneyPulling: moneyPullingValue },
        { 'product.wantMoneyPulling': moneyPullingValue },
      ];
      allOrConditions.push({ $or: moneyPullingConditions });
    }
    if (deliveryStartDate || deliveryEndDate) {
      const dateFilter: any = {};
      if (deliveryStartDate) {
        dateFilter.gte = new Date(deliveryStartDate as string);
      }
      if (deliveryEndDate) {
        dateFilter.lte = new Date(deliveryEndDate as string);
      }
      filter['delivery.date'] = dateFilter;
    }
    if (driverId) {
      filter['driverDetails.id'] = {
        $in: (driverId as string).split(','),
      };
    }

    // Handle status filtering - if status is provided in query, use it; otherwise exclude cancelled orders
    if (status) {
      // If status is provided as a query parameter, use it directly
      if (typeof status === 'string') {
        filter.status = { $in: status.split(',') };
      } else {
        filter.status = status;
      }
    } else {
      // Default: exclude cancelled orders if no status is specified
      filter.status = { $ne: CANCELLED };
    }

    // Handle paid filtering - default to true if not specified
    if (paid !== undefined) {
      filter.paid = paid === 'true' || paid === true;
    } else {
      filter.paid = true;
    }

    // Handle active filtering - default to true if not specified
    if (active !== undefined) {
      filter.active = active === 'true' || active === true;
    } else {
      filter.active = true;
    }

    // STABLE COMBINATION - Combine all $or conditions into $and without deletion
    // If we have multiple $or condition groups (category, flavour, moneyPulling), we need ALL of them to match
    if (allOrConditions.length > 0) {
      // Combine all $or groups with $and
      if (allOrConditions.length === 1) {
        // Single $or group, can use directly
        filter.$or = allOrConditions[0].$or;
      } else {
        // Multiple $or groups, wrap in $and
        filter.$and = filter.$and || [];
        filter.$and.push(...allOrConditions);
      }
    }

    // Combine all base conditions that need to be ANDed together
    if (baseConditions.length > 0) {
      if (filter.$and) {
        // Already have $and, add base conditions
        filter.$and = [...baseConditions, ...filter.$and];
      } else {
        // No $and yet, create it with base conditions
        filter.$and = baseConditions;
      }
    }

    // Clean up query parameters before merging filters
    delete req.query.superCategory;
    delete req.query.category;
    delete req.query.subCategory;
    delete req.query.flavour;
    delete req.query.tag;
    delete req.query.moneyPullingOrders;
    delete req.query.deliveryStartDate;
    delete req.query.deliveryEndDate;
    delete req.query.dateMode;
    delete req.query.dateTo;
    delete req.query.dateFrom;
    delete req.query.driverId;
    delete req.query.status;
    delete req.query.paid;
    delete req.query.active;

    // Apply all filters to req.query
    req.query = { ...req.query, ...filter };

    // Use factory handler getAll() which now uses .lean() for better performance
    await getAll(Order)(req, res, next);
  }
);

export const updateOrder = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { delivery, recipInfo, size, flavour } = req.body;

    // Image uploads are handled by dedicated APIs (updateRefImages/removeRefImage)
    // This API focuses on form data updates only

    // Sanitize top-level size and flavour
    if (size === '' || size === undefined) {
      req.body.size = null;
    }
    if (flavour === '' || flavour === undefined) {
      req.body.flavour = null;
    }

    // Sanitize nested product array fields
    if (req.body.product && Array.isArray(req.body.product)) {
      req.body.product = req.body.product.map((productItem: any) => {
        if (productItem.size === '' || productItem.size === undefined) {
          productItem.size = null;
        }
        if (productItem.flavour === '' || productItem.flavour === undefined) {
          productItem.flavour = null;
        }
        if (productItem.pieces === '' || productItem.pieces === undefined) {
          productItem.pieces = null;
        }
        if (productItem.colour === '' || productItem.colour === undefined) {
          productItem.colour = null;
        }

        return productItem;
      });
    }

    // Handle otherProduct array - no preservation logic needed
    // MongoDB will only update fields that are explicitly provided

    if (delivery) {
      req.body.delivery.date = toUtcDateOnly(delivery.date);

      // Check if delivery method is changing to self-collect
      if (delivery.method) {
        const deliveryMethod = await DeliveryMethod.findById(delivery.method);
        if (deliveryMethod?.name === SELF_COLLECT) {
          // Unassign driver if method changes to self-collect
          req.body.driverDetails = null;
        }
      }
    }
    const before = await Order.findById(req.params.id);

    const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!order) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    await logActivity({
      user: {
        _id: req.user._id,
        firstName: req.user?.firstName || '',
        lastName: req.user?.lastName || '',
        email: req.user?.email || '',
      },
      action: ActivityActions.UPDATE_ORDER,
      module: 'order',
      targetId: order._id.toString(),
      metadata: {
        before,
        after: order,
      },
      brand: req.brand,
    });
    // Updating delivery & woodelivery data
    if (delivery || recipInfo) {
      await createDelivery(order?._id, true);
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: order,
      },
    });
  }
);

export const updateRefImages = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { productItemId, productType = 'product' } = req.body; // productType can be 'product' or 'otherProduct'

    // Ensure files are attached
    if (!req.files?.length) {
      return next(new AppError(REF_IMG_UPDATE.noImg, StatusCode.BAD_REQUEST));
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError(REF_IMG_UPDATE.noOrder, StatusCode.NOT_FOUND));
    }

    let productItem;
    if (productType === 'otherProduct') {
      productItem = order.otherProduct[productItemId];
    } else {
      productItem = order.product[productItemId];
    }

    if (!productItem) {
      return next(new AppError(REF_IMG_UPDATE.noProduct, StatusCode.NOT_FOUND));
    }

    // Initialize additionalRefImages if it doesn't exist
    if (!productItem.additionalRefImages) {
      productItem.additionalRefImages = [];
    }

    // NEW: normalize uploaded images to use CDN URLs
    const normalizedFiles = normalizeImagesToCdn(req.files);
    productItem.additionalRefImages.push(...normalizedFiles);

    await order.save();

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: REF_IMG_UPDATE.imgUploadSuccess,
      data: {
        additionalRefImages: productItem.additionalRefImages,
      },
    });
  }
);

// New function to remove specific additional images
export const removeRefImage = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      productItemId,
      imageKey,
      productType = 'product',
      imageType = 'additionalRefImages',
    } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError(REF_IMG_UPDATE.noOrder, StatusCode.NOT_FOUND));
    }

    let removedFromArray = false;

    // Require productItemId for all image operations
    if (productItemId === undefined || productItemId === null) {
      return next(
        new AppError(
          'Product item ID is required for image operations',
          StatusCode.BAD_REQUEST
        )
      );
    }

    // Restrict refImage deletion to product array only
    if (
      (imageType === 'refImage' || imageType === 'refImages') &&
      productType === 'otherProduct'
    ) {
      return next(
        new AppError(
          'refImage deletion is only supported for product items, not otherProduct items',
          StatusCode.BAD_REQUEST
        )
      );
    }

    let productItem;
    if (productType === 'otherProduct') {
      productItem = order.otherProduct[productItemId];
    } else {
      productItem = order.product[productItemId];
    }

    if (!productItem) {
      return next(new AppError(REF_IMG_UPDATE.noProduct, StatusCode.NOT_FOUND));
    }

    if (imageType === 'refImage') {
      // Handle product-level refImage (single image inside product item)
      if (productItem.refImage && productItem.refImage.key === imageKey) {
        productItem.set('refImage', undefined);
        removedFromArray = true;
      }
    } else {
      // Handle product-level additionalRefImages
      if (!productItem.additionalRefImages) {
        return next(
          new AppError('No additional images found', StatusCode.NOT_FOUND)
        );
      }

      // Remove the image with the specified key
      productItem.additionalRefImages = productItem.additionalRefImages.filter(
        (img: any) => img.key !== imageKey
      );
      removedFromArray = true;
    }

    if (!removedFromArray) {
      return next(
        new AppError(
          `No image found with key: ${imageKey}`,
          StatusCode.NOT_FOUND
        )
      );
    }

    await order.save();

    // Prepare response data based on imageType and productType
    let additionalRefImages;
    let refImage;

    if (imageType === 'refImage') {
      // Only product items can have refImage deleted
      refImage = order.product[productItemId]?.refImage;
    } else if (productType === 'otherProduct') {
      additionalRefImages =
        order.otherProduct[productItemId]?.additionalRefImages;
    } else {
      additionalRefImages = order.product[productItemId]?.additionalRefImages;
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: 'Image removed successfully',
      data: {
        refImage,
        additionalRefImages,
      },
    });
  }
);

export const getWoodeliveryId = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { orderNumber } = req.query;
    const { brand } = req.body;
    const order = await Order.findOne({ orderNumber, brand });
    if (!order) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: order?.woodeliveryTaskId || '',
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
    const {
      id,
      status,
      amount,
      payment_methods,
      reference_number,
      email,
      refunded_amount,
      refunded_at,
      created_at,
      updated_at,
    } = session;
    const orderId = reference_number;
    const hitpayDetails = {
      status,
      amount,
      paymentMethod: payment_methods,
      paymentRequestId: id,
      paymentDate: new Date(created_at),
      updatedAt: new Date(updated_at),
      refundedAmount: refunded_amount,
      refundedAt: refunded_at || null,
    };
    const order = await Order.findByIdAndUpdate(
      orderId,
      { hitpayDetails, paid: true },
      { new: true }
    ).lean();
    // If customer has applied coupon
    if (order!.pricingSummary?.coupon?._id) {
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
    await updateProductAfterPurchase(orderId);
    await createDelivery(orderId);
    await sendOrderConfirmationEmail(email, order);
    // await sendPurchaseEventToGA4(orderId);

    res.status(StatusCode.SUCCESS).send({
      status: 'success',
      message: 'Payment successfull',
    });
  }
);

const handlePaymentFaliureForBob = catchAsync(
  async (session: IHitpayDetails, res: Response) => {
    const {
      id,
      status,
      amount,
      payment_methods,
      reference_number,
      refundedAmount = 0,
      refundedAt = null,
      created_at,
      updated_at,
    } = session;

    const orderId = reference_number;
    const hitpayDetails = {
      status,
      amount,
      paymentMethod: payment_methods,
      paymentRequestId: id,
      paymentDate: new Date(created_at),
      updatedAt: new Date(updated_at),
      refundedAmount,
      refundedAt,
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
    const { status, purpose } = paymentRequest;
    if (verifyHitPayHmac(req, hitpaySignature)) {
      if (status === 'completed' || status === 'pending') {
        // eslint-disable-next-line no-unused-expressions
        purpose === HITPAY_PAYMENT_PURPOSE[0]
          ? updateBobOrderAfterPaymentSuccess(paymentRequest, res)
          : updateCustomiseCakeOrderAfterPaymentSuccess(paymentRequest, res);
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

export const resendOrderConfirmationEmail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { orderId } = req.params;

    if (!orderId) {
      return next(new AppError('Order ID is required', StatusCode.BAD_REQUEST));
    }

    // Fetch the order with populated fields
    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError(ORDER_NOT_FOUND, StatusCode.NOT_FOUND));
    }

    // Get email address - priority: user email > customer email
    const emailAddress = order.user?.email || order.customer?.email;

    if (!emailAddress) {
      return next(
        new AppError(
          'No email address found for this order',
          StatusCode.BAD_REQUEST
        )
      );
    }

    try {
      await sendOrderConfirmationEmail(emailAddress, order);

      res.status(StatusCode.SUCCESS).json({
        status: 'success',
        message: 'Order confirmation email sent successfully',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          emailSentTo: emailAddress,
        },
      });
    } catch (error) {
      console.error('Failed to send order confirmation email:', error);
      return next(
        new AppError(
          'Failed to send confirmation email',
          StatusCode.INTERNAL_SERVER_ERROR
        )
      );
    }
  }
);

export const migrateOrders = catchAsync(async (req: Request, res: Response) => {
  // 1) Receive raw payload
  const rawOrders: any[] = Array.isArray(req.body.orders)
    ? req.body.orders
    : [];
  const failedOrderIds: number[] = [];
  const failedDeliveryIds: number[] = [];

  // 2) Normalize & cast every Order
  const orders = rawOrders.map((o) => {
    // ─ Basic scalars ─────────────────────────────────────
    const sqlId = Number(o.sqlId);
    const createdAt = new Date(o.createdAt);
    const updatedAt = new Date(o.updatedAt);

    // ─ Optional scalars ──────────────────────────────────
    const gaClientId = o.gaClientId ?? undefined;
    const deliveryType: string = o.deliveryType ?? 'single';

    // ─ Snapshot customer (IUser) ─────────────────────────
    // -- if you have user details in payload, spread them here;
    //    otherwise you may need to query the User collection beforehand.
    const customer = {
      firstName: o.customer?.firstName ?? '',
      lastName: o.customer?.lastName ?? '',
      email: o.customer?.email ?? '',
      phone: o.customer?.phone ?? '',
    };

    // ─ Recip Info subdoc ──────────────────────────────────
    const recipInfo = {
      sameAsSender: Boolean(o.recipInfo?.sameAsSender),
      name: o.recipInfo?.name ?? '',
      contact: o.recipInfo?.contact ?? '',
    };

    // ─ Pricing Summary (all strings in schema) ───────────
    const pricingSummary = {
      subTotal: String(o.pricingSummary.subTotal),
      gst: String(o.pricingSummary.gst),
      deliveryCharge: String(o.pricingSummary.deliveryCharge),
      discountedAmt: String(o.pricingSummary.discountedAmt),
      total: String(o.pricingSummary.total),
      coupon: o.pricingSummary.coupon
        ? new mongoose.Types.ObjectId(o.pricingSummary.coupon)
        : undefined,
    };

    // ─ Stripe & HitPay details ────────────────────────────
    const stripeDetails = o.stripeDetails ?? {};
    const hitpayDetails = {
      id: o.hitpayDetails.transactionId || o.hitpayDetails.paymentRequestId,
      status: o.hitpayDetails.status,
      amount: String(o.hitpayDetails.amount),
      paymentMethod: o.hitpayDetails.paymentMethod,
      transactionId: o.hitpayDetails.transactionId ?? '',
      paymentRequestId: o.hitpayDetails.paymentRequestId,
      receiptUrl: o.hitpayDetails.receiptUrl ?? '',
      refundedAmount: o.hitpayDetails.refundedAmount ?? 0,
      refundedAt: o.hitpayDetails.refundedAt ?? null,
    };

    // ─ Products (IProduct[]) ─────────────────────────────
    const product = Array.isArray(o.product)
      ? o.product.map((p: any) => ({
          product: new mongoose.Types.ObjectId(p.product),
          price: p.price,
          discountedPrice: p.discountedPrice,
          quantity: p.quantity,
          size: p.size ? new mongoose.Types.ObjectId(p.size) : undefined,
        }))
      : [];

    // ─ OtherProducts (IOtherProduct[]) ───────────────────
    const otherProduct = Array.isArray(o.otherProduct)
      ? o.otherProduct.map((p: any) => ({
          ...p,
          moneyPulling: Array.isArray(p.moneyPulling)
            ? p.moneyPulling.map((m: any) => ({
                noteType: m.noteType,
                qty: typeof m.qty === 'string' ? Number(m.qty) : m.qty,
              }))
            : [],
        }))
      : [];

    // ─ CustomFormProducts (ICustomFormProduct[]) ─────────
    const customFormProduct = Array.isArray(o.customFormProduct)
      ? o.customFormProduct
      : [];

    // ─ IDs & OrderNumber ──────────────────────────────────
    const _id = new mongoose.Types.ObjectId();
    const orderNumber = o.orderNumber
      ? o.orderNumber
      : await generateUniqueOrderNumber(o.brand);

    // ─ Delivery subdoc (IDelivery) ───────────────────────
    const delivery = {
      date: toUtcDateOnly(o.delivery.date),
      method: new mongoose.Types.ObjectId(o.delivery.method),
      collectionTime: o.delivery.collectionTime,
      address: new mongoose.Types.ObjectId(o.delivery.address),
      recipientEmail: o.delivery.recipientEmail ?? '',
      instructions: o.delivery.instructions ?? '',
    };

    return {
      _id,
      sqlId,
      orderNumber,
      gaClientId,
      brand: o.brand,
      deliveryType,
      product,
      otherProduct,
      customFormProduct,
      user: new mongoose.Types.ObjectId(o.user),
      delivery,
      pricingSummary,
      customer,
      recipInfo,
      paid: Boolean(o.paid),
      corporate: Boolean(o.corporate),
      moneyReceivedForMoneyPulling: Boolean(o.moneyReceivedForMoneyPulling),
      preparationStatus: o.preparationStatus ?? undefined,
      status: o.status ?? undefined,
      stripeDetails,
      hitpayDetails,
      woodeliveryTaskId: o.woodeliveryTaskId ?? '',
      customiseCakeForm: Boolean(o.customiseCakeForm),
      customiseCakeFormDetails: o.customiseCakeFormDetails
        ? new mongoose.Types.ObjectId(o.customiseCakeFormDetails)
        : undefined,
      forKitchenUse: Boolean(o.forKitchenUse),
      active: o.active ?? true,
      createdAt,
      updatedAt,
    };
  });

  // 3) Bulk‐insert Orders
  const orderBulk = Order.collection.initializeUnorderedBulkOp();
  orders.forEach((doc) => orderBulk.insert(doc));
  const orderResult = await orderBulk.execute();
  orderResult.getWriteErrors().forEach((we) => {
    failedOrderIds.push(orders[we.index].sqlId);
  });

  // 4) Bulk‐insert Deliveries (with matching timestamps)
  const deliveryBulk = Delivery.collection.initializeUnorderedBulkOp();
  orders.forEach((order, idx) => {
    if (orderResult.getWriteErrors().some((we) => we.index === idx)) return;

    deliveryBulk.insert({
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,

      sqlId: order.sqlId,
      brand: order.brand,
      order: order._id,
      orderNumber: order.orderNumber,
      customiseCakeOrder: order.customiseCakeFormDetails,
      deliveryDate: order.delivery.date,
      method: order.delivery.method,
      collectionTime: order.delivery.collectionTime,
      address: order.delivery.address,

      customer: order.customer,
      recipientName: order.recipInfo.name,
      recipientPhone: order.recipInfo.contact,
      recipientEmail: order.delivery.recipientEmail,
      woodeliveryTaskId: order.woodeliveryTaskId,
      driverDetails: undefined,
      status: order.status,
      instructions: order.delivery.instructions,
      customiseCakeForm: order.customiseCakeForm,
      active: order.active,
    });
  });
  const deliveryResult = await deliveryBulk.execute();
  deliveryResult.getWriteErrors().forEach((we) => {
    failedDeliveryIds.push(orders[we.index].sqlId);
  });

  // 5) Final response
  res.status(200).json({
    message: 'Migration completed',
    insertedOrders: orderResult.insertedCount,
    insertedDeliveries: deliveryResult.insertedCount,
    failedOrderIds,
    failedDeliveryIds,
  });
});
