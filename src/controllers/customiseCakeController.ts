/* eslint-disable prefer-destructuring */
/* eslint-disable camelcase */
/* eslint-disable consistent-return */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose, { ObjectId } from 'mongoose';
import { Express, NextFunction, Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import {
  HITPAY_PAYMENT_PURPOSE,
  REGULAR_DELIVERY,
  SELF_COLLECT,
  StatusCode,
  brandEnum,
  customiseOrderEnums,
} from '@src/types/customTypes';
import User from '@src/models/userModel';
import {
  calculateBeforeAndAfterDateTime,
  fetchAPI,
  toUtcDateOnly,
} from '@src/utils/functions';
import CustomiseCake, { ICustomiseCake } from '@src/models/customiseCakeModel';
import Address from '@src/models/addressModel';
import AppError from '@src/utils/appError';
import {
  DELIVERY_CREATE_ERROR,
  NO_DATA_FOUND,
  BOB_EMAILS,
  BOB_SMS_CONTENT,
  SMS_SENT,
  EMAIL_SENT,
} from '@src/constants/messages';
import sendEmail from '@src/utils/sendEmail';
import Coupon from '@src/models/couponModel';
import Delivery from '@src/models/deliveryModel';
import { WOODELIVERY_TASK } from '@src/constants/routeConstants';
import { BOB_EMAIL_DETAILS, SELF_COLLECT_ADDRESS } from '@src/constants/static';
import { getAll, getOne } from '@src/utils/factoryHandler';
import DeliveryMethod from '@src/models/deliveryMethodModel';
import sendSms from '@src/utils/sendTwilioOtp';
import Order, { ICustomFormProduct } from '@src/models/orderModel';

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
  customiseCakeForm: boolean;
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

const prepareCompleteAddress = (order: ICustomiseCake) => {
  let completeAddress = '';
  if (order?.delivery?.address?.id) {
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

// Stripe link
// const generatePaymentLink = async (req: Request, customiseCakeId: string) => {
//   const customiseCake = await CustomiseCake.findById(customiseCakeId);
//   const user = await User.findById(customiseCake?.user);
//   const {
//     paymentLink: { subject, template, previewText },
//   } = PINCH_EMAILS;

//   // before creating a new checkout session check if old one is expired
//   if (customiseCake?.checkoutSession.id) {
//     const session = await stripe.checkout.sessions.retrieve(
//       customiseCake?.checkoutSession.id
//     );
//     if (session.status === 'open') {
//       await sendEmail({
//         email: user!.email,
//         subject,
//         template,
//         context: {
//           previewText,
//           customerName: `${customiseCake?.user?.firstName || ''} ${
//             customiseCake?.user?.lastName || ''
//           }`,
//           total: String(customiseCake.total),
//           paymentLink: session.url!,
//         },
//       });
//       return false;
//     }
//   }

//   const productList = [
//     {
//       quantity: customiseCake!.quantity,
//       price_data: {
//         currency: 'sgd',
//         unit_amount: customiseCake!.price * 100, // Stripe expects amount in cents
//         product_data: {
//           name: 'Customise Cake',
//         },
//       },
//     },
//     {
//       quantity: 1,
//       price_data: {
//         currency: 'sgd',
//         unit_amount: (customiseCake!.deliveryFee || 0) * 100, // Stripe expects amount in cents
//         product_data: {
//           name: 'Delivery Fee',
//         },
//       },
//     },
//   ];

//   const session = await stripe.checkout.sessions.create({
//     customer_email: user?.email,
//     payment_method_types: ['paynow', 'card'],
//     success_url: `${req.protocol}://${req.get('host')}`,
//     mode: 'payment',
//     currency: 'sgd',
//     line_items: productList,
//     metadata: {
//       sessionFor: checkoutSessionFor.customiseCake,
//       customiseCakeId: String(customiseCake?._id),
//     },
//   });

//   const checkoutSession = {
//     id: session.id,
//     link: session.url,
//   };
//   await CustomiseCake.findByIdAndUpdate(customiseCakeId, { checkoutSession });

//   await sendEmail({
//     email: user!.email,
//     subject,
//     template,
//     context: {
//       previewText,
//       customerName: `${customiseCake!.user?.firstName} ${
//         customiseCake!.user?.lastName
//       }`,
//       total: String(customiseCake!.total),
//       paymentLink: session.url!,
//     },
//   });

//   return false;
// };

// Hitpay link
const generatePaymentLink = async (
  req: Request,
  customiseCakeId: string,
  next: NextFunction
) => {
  const customiseCake = await CustomiseCake.findById(customiseCakeId);

  const paymentData = {
    purpose: HITPAY_PAYMENT_PURPOSE[1],
    amount: customiseCake?.total,
    currency: 'SGD',
    reference_number: customiseCake?.orderNumber,
    email: customiseCake?.user?.email || '',
    name: `${customiseCake?.user?.firstName || ''} ${
      customiseCake?.user?.lastName || ''
    }`,
    phone: customiseCake?.user?.phone || '',
    send_email: true,
    send_sms: true,
    redirect_url: `${req.protocol}://${req.get('host')}/order-confirm/${
      customiseCake?.id || customiseCake?._id
    }`,
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BUSINESS-API-KEY': process.env.HITPAY_API_KEY!,
    },
    body: JSON.stringify(paymentData),
  };
  const response = await fetch(process.env.HITPAY_API_URL!, options);

  if (!response.ok) {
    const errorData = await response.json();
    return next(new AppError(errorData, StatusCode.BAD_REQUEST));
  }

  const data = await response.json();
  await CustomiseCake.findByIdAndUpdate(
    customiseCakeId,
    { paymentLink: data.url || '' },
    { new: true }
  );
  return data.url; // return payment link
};

export const submitCustomerForm = catchAsync(
  async (req: Request, res: Response) => {
    const { brand, delivery, user, bakes, images } = req.body;
    const { email, firstName, lastName, phone } = user;

    // creating user
    const newUser = {
      brand,
      email,
      firstName,
      lastName,
      phone,
    };
    const filter = { email, brand };
    const update = { $set: newUser };
    const options = { upsert: true, new: true };
    const result = await User.findOneAndUpdate(filter, update, options);

    req.body.user = result?._id;

    if (delivery) {
      const deliveryObj = delivery;
      if (deliveryObj.address) {
        const {
          city,
          country,
          address1,
          address2,
          postalCode,
          unitNumber,
          recipientName,
          recipientPhone,
        } = deliveryObj.address || {};

        // creating address
        const newAddress = {
          brand,
          firstName: recipientName || firstName,
          lastName: recipientName ? '.' : lastName,
          city,
          country,
          address1,
          address2,
          postalCode,
          phone: recipientPhone || phone,
          unitNumber,
          user: new mongoose.Types.ObjectId(result!._id),
        };
        const createdAddress = await Address.create(newAddress);
        deliveryObj.address = createdAddress._id;
      }
      deliveryObj.date = toUtcDateOnly(deliveryObj.date);
      req.body.delivery = deliveryObj;
    }
    if (bakes) {
      const bakesArray = bakes;
      req.body.bakes = bakesArray;
    }
    if (images) {
      const imagesArray = images;
      req.body.images = imagesArray;
    }

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

const createDeliveryDocument = async (
  customiseCake: ICustomiseCake,
  isSelfCollect = false,
  task?: IWoodeliveryResponse,
  update = false
) => {
  const {
    brand,
    delivery: { address, date, time, recipientName, recipientPhone },
    user,
  } = customiseCake;
  const currentUser = await User.findById(user);
  const selfCollectDetails = await DeliveryMethod.findOne({
    name: SELF_COLLECT,
    brand,
  });
  const regularDeliveryDetails = await DeliveryMethod.findOne({
    name: REGULAR_DELIVERY,
    brand,
  });
  const selfCollectId = selfCollectDetails?.id || selfCollectDetails?._id;
  const regularDeliveryId =
    regularDeliveryDetails?.id || regularDeliveryDetails?._id;

  const data: IDeliveryData = {
    brand: customiseCake.brand,
    customiseCakeOrder: customiseCake?._id,
    deliveryDate: new Date(date),
    method: isSelfCollect ? selfCollectId : regularDeliveryId,
    collectionTime: time,
    recipientName: recipientName || currentUser?.firstName,
    recipientPhone: +recipientPhone || +currentUser!.phone!,
    recipientEmail: currentUser?.email,
    customiseCakeForm: true,
  };

  if (task) {
    data.woodeliveryTaskId = task?.data?.guid;
  }
  if (address.id) {
    data.address = address.id;
  }

  if (update) {
    await Delivery.findOneAndUpdate(
      { customiseCakeOrder: customiseCake?._id },
      data
    );
  } else {
    await Delivery.create(data);
  }
};

const createWoodeliveryTask = async (
  customiseCake: ICustomiseCake,
  update = false
) => {
  const {
    brand,
    orderNumber,
    delivery: { address, date, time },
    user,
    woodeliveryTaskId,
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
    tag1: brand,
  };

  if (address) {
    task.destinationAddress = `${address.unitNumber || ''} ${
      address.address1
    }, ${address.address2 || ''}, ${address.company || ''}, ${
      address.country
    }, ${address.postalCode}`;
    task.requesterName = `${address.firstName} ${address.lastName}`;
    task.requesterPhone = String(address.phone);
  }

  return update
    ? fetchAPI(`${WOODELIVERY_TASK}/${woodeliveryTaskId}`, 'PUT', task)
    : fetchAPI(WOODELIVERY_TASK, 'POST', task);
};

const createDelivery = async (
  customiseCake: ICustomiseCake,
  update = false
) => {
  const {
    delivery: { deliveryType },
  } = customiseCake;

  const isSelfCollect = deliveryType === customiseOrderEnums.deliveryType[0];
  if (isSelfCollect) {
    createDeliveryDocument(customiseCake, isSelfCollect, undefined, update);
  } else
    createWoodeliveryTask(customiseCake, update)
      .then(async (response) => {
        const task = await response.json();
        createDeliveryDocument(customiseCake, isSelfCollect, task, update);
        await CustomiseCake.findByIdAndUpdate(customiseCake?._id, {
          woodeliveryTaskId: task.data.guid,
        });
      })
      .catch((err) => console.error(err, DELIVERY_CREATE_ERROR));
};

const syncOrderDB = async (customiseCakeOrder: ICustomiseCake) => {
  const {
    orderNumber,
    brand,
    user,
    paid,
    hitpayDetails,
    woodeliveryTaskId,
    delivery,
    price,
    deliveryFee,
    coupon,
    discountedAmt,
    total,
    candlesAndSparklers,
    bakes,
    quantity,
    size,
    giftCardMsg,
    specialRequest,
    moneyPulling,
    flavour,
  } = customiseCakeOrder;
  let deliveryMethod;
  if (delivery.specificTimeSlot) {
    deliveryMethod = await DeliveryMethod.findOne({
      name: 'Specific Delivery',
      brand,
    });
  } else if (delivery.deliveryType === customiseOrderEnums.deliveryType[0]) {
    deliveryMethod = await DeliveryMethod.findOne({
      name: 'Self-collect',
      brand,
    });
  } else {
    deliveryMethod = await DeliveryMethod.findOne({
      name: 'Regular Delivery',
      brand,
    });
  }
  const deliveryDetails = {
    method: deliveryMethod?.id || deliveryMethod?._id,
    date: delivery.date,
    collectionTime: delivery.time,
    address: delivery.address,
  };
  const pricingSummary = {
    subTotal: String(price),
    gst: '0',
    deliveryCharge: String(deliveryFee),
    coupon,
    discountedAmt: String(discountedAmt),
    total: String(total),
  };
  const customFormProduct: ICustomFormProduct[] = [
    ...bakes,
    ...candlesAndSparklers,
    {
      productName: 'Custom Cake',
      quantity,
      size,
      flavour,
      giftCardMsg,
      specialRequest,
      moneyPulling,
    },
  ];
  const orderData = {
    orderNumber,
    brand,
    user,
    paid,
    hitpayDetails,
    woodeliveryTaskId,
    customiseCakeForm: true,
    delivery: deliveryDetails,
    pricingSummary,
    recipInfo: {
      sameAsSender: false,
      name: delivery.recipientName,
      contact: delivery.recipientPhone,
    },
    customFormProduct,
  };
  await Order.findOneAndUpdate(
    { orderNumber },
    { $set: orderData },
    {
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
};

export const submitAdminForm = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { coupon, candlesAndSparklers, bakes, delivery, user } = req.body;

    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files.images?.length) {
        req.body.images = files.images; // Multiple images
      }

      if (files.baseColourImg?.length) {
        req.body.baseColourImg = files.baseColourImg[0]; // Single image
      }
    }

    if (coupon === '') {
      req.body.coupon = null;
    }
    if (candlesAndSparklers === '') {
      req.body.candlesAndSparklers = [];
    }
    if (bakes === '') {
      req.body.bakes = [];
    }
    if (delivery?.date) {
      req.body.delivery.date = toUtcDateOnly(delivery.date);
    }

    const customiseCakeOrder = await CustomiseCake.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!customiseCakeOrder) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    // Insert/Update custom form into order database
    await syncOrderDB(customiseCakeOrder);

    await generatePaymentLink(req, String(customiseCakeOrder._id), next);

    if (user) {
      await User.findByIdAndUpdate(customiseCakeOrder.user?._id, user);
    }

    // Updating delivery & woodelivery data
    if (delivery) {
      createDelivery(customiseCakeOrder, true);
      // If delivery type got changed from delivery to self-collect then delete the address
      if (
        delivery?.deliveryType === customiseOrderEnums.deliveryType[0] &&
        delivery.address
      ) {
        await Address.findByIdAndDelete(delivery.address);
        delete req.body.delivery.address;
      }
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: customiseCakeOrder,
      },
    });
    return false;
  }
);

const sendOrderConfirmationEmail = async (
  customiseCakeOrder: ICustomiseCake,
  email: string
) => {
  const { subject, template, previewText } =
    BOB_EMAILS.customiseCakeOrderConfirm;

  const { orderNumber, user, quantity, price, deliveryFee, total, delivery } =
    customiseCakeOrder;

  await sendEmail({
    email,
    subject,
    template,
    context: {
      previewText,
      customerName: user.firstName,
      totalAmount: total.toFixed(2),
      orderNo: orderNumber,
      deliveryDate: delivery.date.toDateString(),
      collectionTime: delivery.time,
      address: prepareCompleteAddress(customiseCakeOrder),
      productName: 'Customised Order',
      productQuantity: quantity.toString(),
      productPrice: price.toString(),
      deliveryFee: deliveryFee.toString() || 'FREE',
      faqLink: BOB_EMAIL_DETAILS.faqLink,
      whatsappLink: BOB_EMAIL_DETAILS.whatsappLink,
      homeUrl: BOB_EMAIL_DETAILS.homeUrl,
    },
    brand: 'bob',
  });
};

export const updateCustomiseCakeOrderAfterPaymentSuccess = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any
) => {
  const { id, status, amount, payment_methods, reference_number, email } =
    session;
  const customiseCakeOrderId = reference_number;
  const hitpayDetails = {
    status,
    amount,
    paymentMethod: payment_methods,
    paymentRequestId: id,
  };

  const customiseCakeOrder = await CustomiseCake.findByIdAndUpdate(
    customiseCakeOrderId,
    { hitpayDetails, paid: true },
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
  // Insert/Update custom form into order database
  await syncOrderDB(customiseCakeOrder);
  // Send final confirmation email
  sendOrderConfirmationEmail(customiseCakeOrder, email);
};

export const sendPaymentSms = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    let paymentLink = '';
    const customiseCakeOrder = await CustomiseCake.findById(req.params.id);
    if (!customiseCakeOrder) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    if (customiseCakeOrder.paymentLink) {
      paymentLink = customiseCakeOrder.paymentLink;
    } else {
      paymentLink = await generatePaymentLink(req, req.params.id, next);
    }

    let body = '';
    const phone =
      customiseCakeOrder?.delivery?.recipientPhone ||
      customiseCakeOrder?.delivery?.address?.phone ||
      customiseCakeOrder.user?.phone;

    if (customiseCakeOrder.brand === brandEnum[1]) {
      body = BOB_SMS_CONTENT.paymentReminder(
        paymentLink,
        customiseCakeOrder.orderNumber
      );
      await sendSms(body, phone as string);
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: SMS_SENT,
    });
  }
);

export const sendPaymentEmail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    let paymentLink = '';
    const customiseCakeOrder = await CustomiseCake.findById(req.params.id);
    if (!customiseCakeOrder) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    const { user, total, orderNumber, delivery, quantity, price, deliveryFee } =
      customiseCakeOrder;
    if (customiseCakeOrder.paymentLink) {
      paymentLink = customiseCakeOrder.paymentLink;
    } else {
      paymentLink = await generatePaymentLink(req, req.params.id, next);
    }

    const { subject, template, previewText } = BOB_EMAILS.paymentLink;

    await sendEmail({
      email: customiseCakeOrder.user.email,
      subject,
      template,
      context: {
        previewText,
        customerName: user.firstName,
        totalAmount: total?.toFixed(2) || '0',
        orderNo: orderNumber,
        duration: '24 hours',
        paymentLink,
        deliveryDate: delivery.date.toDateString(),
        collectionTime: delivery.time,
        address: prepareCompleteAddress(customiseCakeOrder),
        productName: 'Customised Order',
        productQuantity: quantity?.toString() || '1',
        productPrice: price.toString(),
        deliveryFee: deliveryFee.toString() || 'FREE',
        faqLink: BOB_EMAIL_DETAILS.faqLink,
        whatsappLink: BOB_EMAIL_DETAILS.whatsappLink,
        homeUrl: BOB_EMAIL_DETAILS.homeUrl,
      },
      brand: 'bob',
    });

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: EMAIL_SENT,
    });
  }
);

export const getAllCustomiseForm = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { moneyPullingOrders, orderNumber, ...otherQueries } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = { ...otherQueries };

    if (moneyPullingOrders) {
      filter.moneyPulling = { $exists: moneyPullingOrders };
    }
    if (orderNumber) {
      filter.orderNumber = {
        $in: (orderNumber as string).split(','),
      };
    }
    req.query = filter;
    await getAll(CustomiseCake)(req, res, next);
  }
);

export const getOneCustomiseCakeForm = getOne(CustomiseCake);
