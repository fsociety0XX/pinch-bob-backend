/* eslint-disable prefer-destructuring */
/* eslint-disable camelcase */
/* eslint-disable consistent-return */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import mongoose, { ObjectId } from 'mongoose';
import { Express, NextFunction, Request, Response } from 'express';
import catchAsync from '@src/utils/catchAsync';
import {
  HITPAY_PAYMENT_PURPOSE,
  StatusCode,
  brandEnum,
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
  BOB_EMAILS,
} from '@src/constants/messages';
import sendEmail from '@src/utils/sendEmail';
import Coupon from '@src/models/couponModel';
import Delivery from '@src/models/deliveryModel';
import { WOODELIVERY_TASK } from '@src/constants/routeConstants';
import { SELF_COLLECT_ADDRESS } from '@src/constants/static';

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
      customiseCake?.orderNumber
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
    const { email, firstName, lastName, phone } = JSON.parse(user);

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

    req.body.user = result?._id;

    if (delivery) {
      const deliveryObj = JSON.parse(delivery);
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

      req.body.delivery = deliveryObj;
    }
    if (bakes) {
      const bakesArray = JSON.parse(bakes);
      req.body.bakes = bakesArray;
    }
    if (images) {
      const imagesArray = JSON.parse(images);
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

    await generatePaymentLink(req, String(doc._id), next);

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
  task?: IWoodeliveryResponse,
  update = false
) => {
  const {
    delivery: { address, date, time, recipientName, recipientPhone },
    user,
  } = customiseCake;
  const currentUser = await User.findById(user);

  const data: IDeliveryData = {
    brand: customiseCake.brand,
    customiseCakeOrder: customiseCake?._id,
    deliveryDate: new Date(date),
    method: isSelfCollect
      ? process.env.SELF_COLLECT_DELIVERY_METHOD_ID!
      : process.env.REGULAR_DELIVERY_METHOD_ID!,
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

const sendOrderConfirmationEmail = async (
  customiseCakeOrder: ICustomiseCake,
  email: string
) => {
  const {
    customiseCakeOrderConfirm: { subject, template, previewText },
  } = customiseCakeOrder.brand === brandEnum[0] ? PINCH_EMAILS : BOB_EMAILS;
  const {
    _id: orderId,
    orderNumber,
    user,
    quantity,
    price,
    deliveryFee,
    discountedAmt,
    total,
    delivery,
    woodeliveryTaskId,
  } = customiseCakeOrder;

  await sendEmail({
    email,
    subject,
    template,
    context: {
      previewText,
      orderId,
      orderNo: orderNumber,
      customerName: `${user.firstName} ${user.lastName}`,
      qty: String(quantity),
      subTotal: String(price),
      deliveryCharge: String(deliveryFee || 0),
      discountedAmt: String(discountedAmt || 0),
      total: String(total),
      deliveryDate: new Date(delivery.date)?.toDateString(),
      deliveryMethod: delivery.deliveryType,
      collectionTime: delivery?.time || '',
      address: prepareCompleteAddress(customiseCakeOrder),
      trackingLink: woodeliveryTaskId
        ? `https://app.woodelivery.com/t?q=${woodeliveryTaskId}`
        : '',
    },
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

  // Send final confirmation email
  sendOrderConfirmationEmail(customiseCakeOrder, email);
};

export const sendPaymentLink = catchAsync(
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

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: COUPON_SCHEMA_VALIDATION.paymentLinkSent,
      data: paymentLink, // TODO: Send this via email
    });
  }
);

export const updateCustomiseCakeForm = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req.body;

    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files.images?.length) {
        req.body.images = files.images; // Multiple images
      }

      if (files.baseColourImg?.length) {
        req.body.baseColourImg = files.baseColourImg[0]; // Single image
      }
    }
    const customiseCakeOrder = await CustomiseCake.findByIdAndUpdate(
      req.params.id,
      { new: true }
    );

    if (!customiseCakeOrder) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    if (user) {
      await User.findByIdAndUpdate(customiseCakeOrder.user?._id, user);
    }

    // Updating delivery & woodelivery data
    if (req.body?.delivery) {
      createDelivery(customiseCakeOrder, true);
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: customiseCakeOrder,
      },
    });
  }
);
