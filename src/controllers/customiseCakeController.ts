/* eslint-disable camelcase */
import mongoose, { ObjectId } from 'mongoose';
import { Express, NextFunction, Request, Response } from 'express';
import { IRequestWithUser } from './authController';
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
  generateUniqueOrderNumber,
} from '@src/utils/functions';
import { normalizeImagesToCdn } from '@src/utils/cdn';
import CustomiseCake, { ICustomiseCake } from '@src/models/customiseCakeModel';
import Address from '@src/models/addressModel';
import AppError from '@src/utils/appError';
import {
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
import logActivity, { ActivityActions } from '@src/utils/activityLogger';

interface IPhoto {
  key: string;
  originalname: string;
  mimetype: string;
  size: number;
  location: string;
}

interface IWoodeliveryResponse {
  data?: {
    guid: string;
  };
  json(): Promise<unknown>;
}

interface IDeliveryData {
  brand: string;
  orderNumber: string;
  customiseCakeOrder: string;
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
  customiseCakeForm: boolean;
  status?: string;
  paid?: boolean;
  instructions?: string;
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
  taskGuid?: string;
  destinationNotes?: string;
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

const generatePaymentLink = async (
  req: Request,
  customiseCakeId: string,
  next: NextFunction
) => {
  const customiseCake = await CustomiseCake.findById(customiseCakeId);

  // Find the corresponding order using the orderNumber
  const order = await Order.findOne({
    orderNumber: customiseCake?.orderNumber,
  });

  const paymentData = {
    purpose: HITPAY_PAYMENT_PURPOSE[1],
    amount: customiseCake?.total,
    currency: 'SGD',
    reference_number: customiseCakeId,
    email: customiseCake?.user?.email || '',
    name: `${customiseCake?.user?.firstName || ''} ${
      customiseCake?.user?.lastName || ''
    }`,
    phone: customiseCake?.user?.phone || '',
    send_email: true,
    send_sms: true,
    redirect_url: `${req.protocol}://${req.get('host')}/order-confirm/${
      order?.id || order?._id || customiseCake?.id || customiseCake?._id
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
  return data.url;
};

export const submitCustomerForm = catchAsync(
  async (req: Request, res: Response) => {
    const { brand, delivery, user, bakes, images } = req.body;
    const { email, firstName, lastName, phone } = user;

    // Find existing user by email and brand first
    let result = await User.findOne({ email, brand });

    if (result) {
      // User exists, update safely without causing conflicts
      const updateData: Partial<{
        firstName: string;
        lastName: string;
        phone: string;
      }> = {
        firstName,
        lastName,
      };

      // Only update phone if it doesn't conflict with another user
      if (phone && phone !== result.phone) {
        const existingUserWithPhone = await User.findOne({
          phone,
          brand,
          _id: { $ne: result._id }, // Exclude current user
        });

        if (!existingUserWithPhone) {
          updateData.phone = phone;
        }
        // If phone conflicts, keep existing phone
      }

      try {
        result = await User.findByIdAndUpdate(result._id, updateData, {
          new: true,
        });
      } catch (updateError) {
        console.log('User update failed in submitCustomerForm:', updateError);
        // Continue with existing user data
      }
    } else {
      // User doesn't exist, create new one with conflict checks
      const newUserData: {
        brand: string;
        email: string;
        firstName: string;
        lastName: string;
        phone?: string;
      } = {
        brand,
        email,
        firstName,
        lastName,
      };

      // Check if phone is available before creating user
      if (phone) {
        const existingUserWithPhone = await User.findOne({ phone, brand });
        if (!existingUserWithPhone) {
          newUserData.phone = phone;
        }
        // If phone conflicts, create user without phone - they can update later
      }

      try {
        result = await User.create(newUserData);
      } catch (createError) {
        console.log('User creation failed in submitCustomerForm:', createError);
        // If creation fails, try to find user by email one more time
        result = await User.findOne({ email, brand });
        if (!result) {
          throw createError; // Re-throw if we still can't find or create a user
        }
      }
    }

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
      if (deliveryObj.date) {
        deliveryObj.date = toUtcDateOnly(deliveryObj.date);
      }
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
    // NEW: ensure customise cake uploads store CDN URLs
    if (Array.isArray(req.body.images)) {
      req.body.images = normalizeImagesToCdn(req.body.images);
    }

    if (!req.body.orderNumber) {
      req.body.orderNumber = await generateUniqueOrderNumber(req.body.brand);
    }

    // Use session for atomic operations
    const session = await mongoose.startSession();
    let doc;

    try {
      await session.withTransaction(async () => {
        // Double-check order number uniqueness within transaction
        const [existingOrder, existingCustomiseCake] = await Promise.all([
          Order.findOne({ orderNumber: req.body.orderNumber }).session(session),
          CustomiseCake.findOne({ orderNumber: req.body.orderNumber }).session(
            session
          ),
        ]);

        if (existingOrder || existingCustomiseCake) {
          // Generate new order number if collision detected
          req.body.orderNumber = await generateUniqueOrderNumber(
            req.body.brand
          );
        }

        const createdDocs = await CustomiseCake.create([req.body], { session });
        [doc] = createdDocs; // create() with session returns array
      });
    } finally {
      await session.endSession();
    }

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
  task?: IWoodeliveryResponse
) => {
  try {
    const {
      brand,
      delivery: {
        address,
        date,
        time,
        recipientName,
        recipientPhone,
        instructions,
      },
      user,
    } = customiseCake;

    // Handle both populated and non-populated user field
    const currentUser =
      user && typeof user === 'object' && 'firstName' in user
        ? user
        : await User.findById(user);

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
      customiseCakeOrder: customiseCake._id.toString(),
      deliveryDate: new Date(date),
      method: isSelfCollect ? selfCollectId : regularDeliveryId,
      collectionTime: time,
      recipientName: recipientName || currentUser?.firstName,
      recipientPhone: Number(recipientPhone) || Number(currentUser?.phone || 0),
      recipientEmail: currentUser?.email,
      customiseCakeForm: true,
      orderNumber: customiseCake.orderNumber,
      customer: {
        firstName: currentUser?.firstName || '',
        lastName: currentUser?.lastName || '',
        email: currentUser?.email || '',
        phone: currentUser?.phone || '',
      },
      paid: customiseCake.paid || false, // Ensure paid status is set
      instructions: instructions || '',
    };

    if (task) {
      data.woodeliveryTaskId = task?.data?.guid;
    }
    if (address?.id) {
      data.address = address.id;
    }

    // Always use upsert to prevent duplicates
    const result = await Delivery.findOneAndUpdate(
      { customiseCakeOrder: customiseCake._id },
      data,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return result;
  } catch (error: unknown) {
    console.error('💥 Error in createDeliveryDocument:', error);

    // Handle duplicate key errors gracefully
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      const existing = await Delivery.findOne({
        customiseCakeOrder: customiseCake._id,
      });
      return existing;
    }

    throw error;
  }
};

const createWoodeliveryTask = async (
  customiseCake: ICustomiseCake,
  update = false
) => {
  const {
    brand,
    orderNumber,
    delivery: {
      address,
      date,
      time,
      instructions,
      recipientName,
      recipientPhone,
    },
    user,
    woodeliveryTaskId,
  } = customiseCake;

  // Handle both populated and non-populated user field
  // Handle both populated and non-populated user field
  const currentUser =
    user && typeof user === 'object' && 'firstName' in user
      ? user
      : await User.findById(user);

  const task: IWoodeliveryTask = {
    taskTypeId: 1,
    externalKey: orderNumber,
    afterDateTime: calculateBeforeAndAfterDateTime(String(date), time)
      .afterDateTime,
    beforeDateTime: calculateBeforeAndAfterDateTime(String(date), time)
      .beforeDateTime,
    requesterEmail: currentUser!.email!,
    recipientEmail: currentUser!.email!,
    recipientName: recipientName || currentUser?.firstName || '',
    recipientPhone: String(recipientPhone || currentUser?.phone || ''),
    tag1: brand,
    destinationNotes: instructions || '',
  };

  if (address) {
    // Build address parts array and filter out empty values
    const addressParts = [
      address.unitNumber?.trim(),
      address.address1?.trim(),
      address.address2?.trim(),
      address.company?.trim(),
      address.city?.trim(),
      address.country?.trim(),
      address.postalCode?.trim(),
    ].filter((part) => part && part !== ''); // Remove empty/undefined parts

    task.destinationAddress = addressParts.join(', ');
    task.requesterName = `${address.firstName} ${address.lastName}`;
    task.requesterPhone = String(address.phone);
  }

  if (woodeliveryTaskId) {
    task.taskGuid = woodeliveryTaskId;
  }

  try {
    const response = update
      ? await fetchAPI(`${WOODELIVERY_TASK}/${woodeliveryTaskId}`, 'PUT', task)
      : await fetchAPI(WOODELIVERY_TASK, 'POST', task);

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Woodelivery API Error:', responseData);
      throw new Error(`Woodelivery API Error: ${JSON.stringify(responseData)}`);
    }

    // Return the parsed data instead of the response
    return {
      ok: response.ok,
      status: response.status,
      data: responseData,
      json: () => Promise.resolve(responseData), // For backward compatibility
    };
  } catch (error) {
    console.error('💥 Woodelivery API Call Failed:', error);
    throw error;
  }
};

const updateWoodeliveryTaskId = async (
  customiseCake: ICustomiseCake,
  woodeliveryTaskId: string
) => {
  // Update CustomiseCake model
  await CustomiseCake.findByIdAndUpdate(customiseCake._id, {
    woodeliveryTaskId,
  });

  // Update corresponding Order model
  await Order.findOneAndUpdate(
    {
      $or: [
        { orderNumber: customiseCake.orderNumber },
        { customiseCakeFormDetails: customiseCake._id },
      ],
    },
    { $set: { woodeliveryTaskId } },
    { new: true }
  );
};

const createDelivery = async (
  customiseCake: ICustomiseCake,
  update = false
) => {
  const {
    delivery: { deliveryType },
  } = customiseCake;

  // Check if delivery already exists
  const existingDelivery = await Delivery.findOne({
    customiseCakeOrder: customiseCake._id,
  });

  const isSelfCollect = deliveryType === customiseOrderEnums.deliveryType[0];

  try {
    if (isSelfCollect) {
      // Self-collect: Create or update delivery document without woodelivery task
      await createDeliveryDocument(customiseCake, isSelfCollect, undefined);
      return;
    }

    // Regular delivery: Handle woodelivery task creation/updates
    if (!customiseCake.woodeliveryTaskId && customiseCake.paid) {
      // No woodelivery task exists, create new one regardless of delivery existence
      const response = await createWoodeliveryTask(customiseCake, false);
      const task = await response.json();

      await createDeliveryDocument(customiseCake, isSelfCollect, task);

      // Update both CustomiseCake and Order models with new task ID
      await updateWoodeliveryTaskId(customiseCake, task.data.guid);
    } else if (existingDelivery && update && customiseCake.paid) {
      // Woodelivery task exists and we're updating, update existing task
      const response = await createWoodeliveryTask(customiseCake, true);
      const task = await response.json();
      await createDeliveryDocument(customiseCake, isSelfCollect, task);

      // Update both CustomiseCake and Order models with updated task ID
      await updateWoodeliveryTaskId(customiseCake, task.data.guid);
    } else {
      // Woodelivery task exists but no update needed, just update/create delivery document
      await createDeliveryDocument(customiseCake, isSelfCollect, undefined);
    }
  } catch (error) {
    console.error('💥 Error in createDelivery:', error);
    throw error;
  }
};

// Helper function to get delivery method based on delivery type
const getDeliveryMethod = async (
  delivery: { specificTimeSlot?: boolean; deliveryType?: string },
  brand: string
) => {
  if (delivery.specificTimeSlot) {
    return DeliveryMethod.findOne({
      name: 'Specific Delivery',
      brand,
    });
  }
  if (delivery.deliveryType === customiseOrderEnums.deliveryType[0]) {
    return DeliveryMethod.findOne({
      name: 'Self-collect',
      brand,
    });
  }
  return DeliveryMethod.findOne({
    name: 'Regular Delivery',
    brand,
  });
};

/**
 * Reusable function to build order payload for both create and update operations
 * This ensures consistency between Order creation and CustomiseCake synchronization
 * @param customiseCakeOrder - The customise cake order data
 * @param forUpdate - If true, returns flattened update object for MongoDB $set operations
 * @returns Promise<Object> - Standardized order payload or update object
 */
const buildOrderPayload = async (
  customiseCakeOrder: ICustomiseCake,
  forUpdate = false
) => {
  const {
    _id,
    orderNumber,
    brand,
    user,
    paid,
    moneyPaidForMoneyPulling,
    moneyPullingPrepared,
    moneyReceivedForMoneyPulling,
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
    isMoneyPulling,
    superCategory,
    category,
    subCategory,
    createdAt,
  } = customiseCakeOrder;

  // Get delivery method
  const deliveryMethod = await getDeliveryMethod(delivery, brand);

  const deliveryDetails = {
    method: deliveryMethod?.id || deliveryMethod?._id,
    date: delivery.date,
    collectionTime: delivery.time,
    address: delivery.address,
    instructions: delivery.instructions || '',
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
      superCategory,
      category,
      subCategory,
    },
  ];

  const basePayload = {
    orderNumber,
    brand,
    user,
    customFormProduct,
    paid,
    corporate: false, // Customise cake orders are not corporate
    moneyPaidForMoneyPulling,
    moneyPullingPrepared,
    moneyReceivedForMoneyPulling: moneyReceivedForMoneyPulling || false, // Use value from customise cake or default to false
    isMoneyPulling,
    hitpayDetails,
    woodeliveryTaskId,
    customiseCakeForm: true,
    customiseCakeFormDetails: _id,
    delivery: deliveryDetails,
    createdAt,
    pricingSummary,
    recipInfo: {
      sameAsSender: false,
      name: delivery.recipientName,
      contact: delivery.recipientPhone,
    },
    customer: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user?.email || '',
      phone: user?.phone || '',
    },
    status: 'Unassigned',
  };

  // If it's for update, return flattened object for MongoDB $set operations
  if (forUpdate) {
    return {
      // Core fields
      orderNumber,
      brand,
      user,
      paid,
      corporate: false,
      moneyPaidForMoneyPulling,
      moneyPullingPrepared,
      moneyReceivedForMoneyPulling: moneyReceivedForMoneyPulling || false,
      isMoneyPulling,
      hitpayDetails,
      woodeliveryTaskId,
      customiseCakeForm: true,
      customiseCakeFormDetails: _id,
      customFormProduct,
      createdAt,
      // Flatten delivery details for proper nested updates
      'delivery.method': deliveryDetails.method,
      'delivery.date': deliveryDetails.date,
      'delivery.collectionTime': deliveryDetails.collectionTime,
      'delivery.address': deliveryDetails.address,
      'delivery.instructions': deliveryDetails.instructions,
      // Flatten pricing summary for proper nested updates
      'pricingSummary.subTotal': pricingSummary.subTotal,
      'pricingSummary.gst': pricingSummary.gst,
      'pricingSummary.deliveryCharge': pricingSummary.deliveryCharge,
      'pricingSummary.coupon': pricingSummary.coupon,
      'pricingSummary.discountedAmt': pricingSummary.discountedAmt,
      'pricingSummary.total': pricingSummary.total,
      // Update other nested fields
      'recipInfo.sameAsSender': false,
      'recipInfo.name': delivery.recipientName,
      'recipInfo.contact': delivery.recipientPhone,
      'customer.firstName': user.firstName,
      'customer.lastName': user.lastName,
      'customer.email': user?.email || '',
      'customer.phone': user?.phone || '',
    };
  }

  // Return complete payload for creation
  return basePayload;
};

/**
 * Synchronizes CustomiseCake data with Order model
 * Creates new order if it doesn't exist, updates existing order if found
 * Prevents duplicate orders by checking both orderNumber and customiseCakeFormDetails
 * @param customiseCakeOrder - The customise cake order data to sync
 */
const syncOrderDB = async (customiseCakeOrder: ICustomiseCake) => {
  const { _id, orderNumber } = customiseCakeOrder;

  // Check if order already exists to prevent duplicates
  // Check both by orderNumber and customiseCakeFormDetails to ensure uniqueness
  const existingOrder = await Order.findOne({
    $or: [{ orderNumber }, { customiseCakeFormDetails: _id }],
  });

  if (existingOrder) {
    // Update existing order using the same payload builder to ensure consistency
    const updateData = await buildOrderPayload(customiseCakeOrder, true);

    await Order.findOneAndUpdate(
      { _id: existingOrder._id },
      { $set: updateData },
      { new: true }
    );
    return;
  }

  // Create new order using the reusable payload builder
  const orderData = await buildOrderPayload(customiseCakeOrder);

  // Create new order only if it doesn't exist
  try {
    await Order.create(orderData);
  } catch (error: unknown) {
    // Handle duplicate key error (if order somehow already exists)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      console.log(
        `Order with orderNumber ${orderNumber} already exists, skipping creation`
      );
      return;
    }
    throw error; // Re-throw other errors
  }
};

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

export const submitAdminForm = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    const { coupon, candlesAndSparklers, bakes, delivery, user } = req.body;
    const customFormData = { ...req.body };

    // Get the original order state to check payment status
    const originalOrder = await CustomiseCake.findById(req.params.id);
    const wasAlreadyPaid = originalOrder!.paid === true;

    // Image uploads are handled by dedicated APIs (addRefImages/removeRefImage)
    // This API focuses on form data updates only

    if (coupon === '') {
      customFormData.coupon = null;
    }
    if (candlesAndSparklers === '') {
      customFormData.candlesAndSparklers = [];
    }
    if (bakes === '') {
      customFormData.bakes = [];
    }
    if (delivery?.date) {
      customFormData.delivery.date = toUtcDateOnly(delivery.date);
    }
    if (
      delivery?.address === '' ||
      delivery?.deliveryType === customiseOrderEnums.deliveryType[0]
    ) {
      customFormData.delivery.address = null;
    }
    if (customFormData.manuallyProcessed) {
      customFormData.paid = true;
    }
    const customiseCakeOrder = await CustomiseCake.findByIdAndUpdate(
      req.params.id,
      customFormData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!customiseCakeOrder) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    // Log the activity
    await logActivity({
      user: {
        _id: req.user?._id || '',
        firstName: req.user?.firstName || '',
        lastName: req.user?.lastName || '',
        email: req.user?.email || '',
      },
      action: ActivityActions.UPDATE_CUSTOMISE_CAKE,
      module: 'customiseCake',
      targetId: customiseCakeOrder?._id?.toString() || '',
      metadata: {
        before: originalOrder,
        after: customiseCakeOrder,
        wasAlreadyPaid,
        isNewlyPaid: customiseCakeOrder.paid === true && !wasAlreadyPaid,
        orderNumber: customiseCakeOrder?.orderNumber || '',
      },
      brand: customiseCakeOrder?.brand || '',
    });

    await syncOrderDB(customiseCakeOrder);
    // Check if this is a newly paid order (manual processing) vs existing paid order being updated
    const isNewlyPaid = customiseCakeOrder.paid === true && !wasAlreadyPaid;

    // Handle different scenarios based on payment status and delivery changes
    if (customiseCakeOrder.paid) {
      // Create/update delivery for paid orders (both new and existing)
      if (delivery || isNewlyPaid) {
        await createDelivery(customiseCakeOrder, true);
      }

      // Handle coupon logic only for newly paid orders to prevent duplicate coupon usage
      if (isNewlyPaid && customiseCakeOrder.coupon) {
        const existingUser = await User.findById(customiseCakeOrder.user);
        if (
          existingUser?.usedCoupons &&
          !existingUser.usedCoupons?.includes(customiseCakeOrder.coupon)
        ) {
          existingUser.usedCoupons!.push(customiseCakeOrder.coupon);
          await existingUser.save();
        }
        await Coupon.updateOne(
          { _id: customiseCakeOrder.coupon },
          { $inc: { used: 1 } }
        );
      }

      // Send confirmation email only for newly paid orders, not for updates
      if (isNewlyPaid) {
        await sendOrderConfirmationEmail(
          customiseCakeOrder,
          customiseCakeOrder.user?.email || ''
        );
      }
    }
    // Update delivery if delivery details changed
    if (delivery) {
      await createDelivery(customiseCakeOrder, true);
    }

    if (user) {
      await User.findByIdAndUpdate(
        customiseCakeOrder.user?._id || customiseCakeOrder.user,
        user
      );
    }

    // Handle address cleanup for self-collect orders
    if (
      delivery?.deliveryType === customiseOrderEnums.deliveryType[0] &&
      delivery.address
    ) {
      await Address.findByIdAndDelete(delivery.address);
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: customiseCakeOrder,
      },
    });
  }
);

interface IHitpaySession {
  id: string;
  status: string;
  amount: number;
  refunded_amount: number;
  refunded_at: Date;
  payment_methods: string[];
  reference_number: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export const updateCustomiseCakeOrderAfterPaymentSuccess = async (
  session: IHitpaySession
): Promise<AppError | undefined> => {
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
  const customiseCakeOrderId = reference_number;
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

  const customiseCakeOrder = await CustomiseCake.findByIdAndUpdate(
    customiseCakeOrderId,
    { hitpayDetails, paid: true },
    { new: true }
  );

  if (!customiseCakeOrder) {
    console.error('❌ CustomiseCake order not found:', customiseCakeOrderId);
    return new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND);
  }

  try {
    // If customer has applied coupon
    if (customiseCakeOrder.coupon) {
      const user = await User.findById(customiseCakeOrder.user);
      if (
        user?.usedCoupons &&
        !user.usedCoupons?.includes(customiseCakeOrder.coupon)
      ) {
        user.usedCoupons!.push(customiseCakeOrder.coupon);
      }
      await Coupon.updateOne(
        { _id: customiseCakeOrder.coupon },
        { $inc: { used: 1 } }
      );
      await user!.save();
    }

    // Create delivery
    await createDelivery(customiseCakeOrder);
    // Sync to Order DB - but only if order doesn't already exist
    await syncOrderDB(customiseCakeOrder);
    await sendOrderConfirmationEmail(customiseCakeOrder, email);
  } catch (error) {
    console.error(
      '💥 Error in updateCustomiseCakeOrderAfterPaymentSuccess:',
      error
    );
    throw error;
  }
};

export const sendPaymentSms = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const customiseCakeOrder = await CustomiseCake.findById(req.params.id);
    if (!customiseCakeOrder) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    const paymentLink = await generatePaymentLink(req, req.params.id, next);

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
    const customiseCakeOrder = await CustomiseCake.findById(req.params.id);
    if (!customiseCakeOrder) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    const { user, total, orderNumber, delivery, quantity, price, deliveryFee } =
      customiseCakeOrder;

    const paymentLink = await generatePaymentLink(req, req.params.id, next);
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

    const filter: Record<string, unknown> = { ...otherQueries };

    if (moneyPullingOrders) {
      filter.moneyPulling = { $exists: moneyPullingOrders };
    }
    if (orderNumber) {
      filter.orderNumber = {
        $in: (orderNumber as string).split(','),
      };
    }
    req.query = filter as Request['query'];
    await getAll(CustomiseCake)(req, res, next);
  }
);

export const getOneCustomiseCakeForm = getOne(CustomiseCake);

export const addRefImages = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    const { imageType = 'additionalRefImages' } = req.body;

    // Ensure files are attached
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      return next(new AppError('No images provided', StatusCode.BAD_REQUEST));
    }

    const customiseCakeOrder = await CustomiseCake.findById(req.params.id);
    if (!customiseCakeOrder) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    // Handle different upload formats from multer .any()
    let files: Express.Multer.File[] = [];
    if (Array.isArray(req.files)) {
      files = req.files;
    } else {
      // req.files is an object with field names as keys
      const fileObj = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };
      if (fileObj.additionalRefImages) {
        files = fileObj.additionalRefImages;
      } else if (fileObj.baseColourImg) {
        files = fileObj.baseColourImg;
      } else {
        // Get first available field
        const firstKey = Object.keys(fileObj)[0];
        if (firstKey) {
          files = fileObj[firstKey];
        }
      }
    }

    if (files.length === 0) {
      return next(new AppError('No images provided', StatusCode.BAD_REQUEST));
    }

    if (imageType === 'baseColourImg') {
      // For baseColourImg, only allow single image
      if (files.length > 1) {
        return next(
          new AppError(
            'Only one base colour image allowed',
            StatusCode.BAD_REQUEST
          )
        );
      }
      // NEW: normalize base colour image to use CDN URL
      const normalizedFile = normalizeImagesToCdn([files[0]]);
      customiseCakeOrder.baseColourImg = normalizedFile[0] as unknown as IPhoto;
    } else {
      // For additionalRefImages, allow multiple images
      if (!customiseCakeOrder?.additionalRefImages) {
        customiseCakeOrder.additionalRefImages = [];
      }
      // NEW: normalize images to use CDN URLs
      const normalizedFiles = normalizeImagesToCdn(files);
      customiseCakeOrder.additionalRefImages.push(
        ...(normalizedFiles as unknown as IPhoto[])
      );
    }

    await customiseCakeOrder.save();

    // Log the activity
    await logActivity({
      user: {
        _id: req.user?._id || '',
        firstName: req.user?.firstName || '',
        lastName: req.user?.lastName || '',
        email: req.user?.email || '',
      },
      action: ActivityActions.ADD_CUSTOMISE_CAKE_REF_IMAGES,
      module: 'customiseCake',
      targetId: customiseCakeOrder?._id?.toString() || '',
      metadata: {
        imageType,
        imagesAdded: files?.length || 0,
        orderNumber: customiseCakeOrder?.orderNumber || '',
        imageFileNames:
          files?.map((file) => file?.originalname || 'unknown') || [],
      },
      brand: customiseCakeOrder?.brand || '',
    });

    const responseData: Record<string, unknown> = {};
    if (imageType === 'baseColourImg') {
      responseData.baseColourImg = customiseCakeOrder?.baseColourImg || null;
    } else {
      responseData.additionalRefImages =
        customiseCakeOrder?.additionalRefImages || [];
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: `${
        imageType === 'baseColourImg'
          ? 'Base colour image'
          : 'Additional reference images'
      } uploaded successfully`,
      data: responseData,
    });
  }
);

export const removeRefImage = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    const { imageKey, imageType = 'additionalRefImages' } = req.body;

    if (!imageKey) {
      return next(
        new AppError('Image key is required', StatusCode.BAD_REQUEST)
      );
    }

    const customiseCakeOrder = await CustomiseCake.findById(req.params.id);
    if (!customiseCakeOrder) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    let removedFromArray = false;

    if (imageType === 'images') {
      // Remove from customer uploaded images
      if (customiseCakeOrder?.images && customiseCakeOrder.images.length > 0) {
        customiseCakeOrder.images = customiseCakeOrder.images.filter(
          (img: IPhoto) => img?.key !== imageKey
        );
        removedFromArray = true;
      }
    } else if (imageType === 'additionalRefImages') {
      // Remove from admin uploaded additional images
      if (
        customiseCakeOrder?.additionalRefImages &&
        customiseCakeOrder.additionalRefImages.length > 0
      ) {
        customiseCakeOrder.additionalRefImages =
          customiseCakeOrder.additionalRefImages.filter(
            (img: IPhoto) => img?.key !== imageKey
          );
        removedFromArray = true;
      }
    } else if (imageType === 'baseColourImg') {
      // Remove base colour image
      if (
        customiseCakeOrder?.baseColourImg &&
        customiseCakeOrder.baseColourImg?.key === imageKey
      ) {
        customiseCakeOrder.set('baseColourImg', undefined);
        removedFromArray = true;
      }
    }

    if (!removedFromArray) {
      return next(
        new AppError(
          `No image found with key: ${imageKey}`,
          StatusCode.NOT_FOUND
        )
      );
    }

    await customiseCakeOrder.save();

    // Log the activity
    await logActivity({
      user: {
        _id: req.user?._id || '',
        firstName: req.user?.firstName || '',
        lastName: req.user?.lastName || '',
        email: req.user?.email || '',
      },
      action: ActivityActions.REMOVE_CUSTOMISE_CAKE_REF_IMAGE,
      module: 'customiseCake',
      targetId: customiseCakeOrder?._id?.toString() || '',
      metadata: {
        imageType,
        imageKey,
        orderNumber: customiseCakeOrder?.orderNumber || '',
        removedFromArray: true,
      },
      brand: customiseCakeOrder?.brand || '',
    });

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      message: 'Image removed successfully',
      data: {
        images: customiseCakeOrder?.images || [],
        additionalRefImages: customiseCakeOrder?.additionalRefImages || [],
        baseColourImg: customiseCakeOrder?.baseColourImg || null,
      },
    });
  }
);
