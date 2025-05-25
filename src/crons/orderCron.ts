/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import cron from 'node-cron';
import { FilterQuery } from 'mongoose';
import Order, { IOrder } from '@src/models/orderModel';
import { brandEnum, CANCELLED, SELF_COLLECT } from '@src/types/customTypes';
import sendEmail from '@src/utils/sendEmail';
import { PINCH_EMAILS, BOB_EMAILS } from '@src/constants/messages';
import {
  formatAddress,
  formatShortDate,
  getOneYearAgoWindow,
  getTomorrowUtcRange,
  getYesterdayUtcRange,
  makeStatusUrl,
} from '@src/utils/functions';
import User from '@src/models/userModel';
import { PRODUCTION } from '@src/constants/static';
import sendSms from '@src/utils/sendTwilioOtp';
import DeliveryMethod from '@src/models/deliveryMethodModel';

// Generic channel descriptor
type Channel<T> = {
  send: (payload: T) => Promise<any>;
  buildPayload: (order: IOrder) => T;
  onError?: (order: IOrder, err: any) => void;
};

// Central dispatcher
async function dispatchForOrders<T>(
  query: FilterQuery<IOrder>,
  channels: Channel<T>[]
) {
  const orders = await Order.find(query)
    .populate('delivery.address')
    .populate('delivery.method')
    .populate('user')
    .populate('recipInfo');

  if (!orders.length) {
    console.log(`No orders for query ${JSON.stringify(query)}`);
    return;
  }

  const tasks = orders.map((order) =>
    Promise.all(
      channels.map(async (ch) => {
        try {
          const payload = ch.buildPayload(order);
          await ch.send(payload);
        } catch (err) {
          // eslint-disable-next-line no-unused-expressions
          ch.onError
            ? ch.onError(order, err)
            : console.error(`Failed for order ${order.orderNumber}`, err);
        }
      })
    )
  );

  await Promise.allSettled(tasks);
}

// Brand configuration
const brandConfigs = [
  {
    name: brandEnum[1],
    smsEnabled: true,
    selfCollectMethodName: SELF_COLLECT,
  },
  {
    name: brandEnum[0],
    smsEnabled: false,
    selfCollectMethodName: SELF_COLLECT,
  },
];

// CRON scheduled task that runs once a day at midnight
cron.schedule('0 0 * * *', async () => {
  if (process.env.NODE_ENV !== PRODUCTION) return;
  const { start, end } = getTomorrowUtcRange();

  // eslint-disable-next-line no-restricted-syntax
  for (const {
    name: brand,
    smsEnabled,
    selfCollectMethodName,
  } of brandConfigs) {
    const brandDisplayName =
      brand === brandEnum[0] ? 'PinchBakehouse' : 'BobTheBakerBoy';

    const selfCollect = await DeliveryMethod.findOne({
      name: selfCollectMethodName,
      brand,
    });
    if (!selfCollect) {
      console.warn(`No self-collect method for brand ${brand}`);
    }

    // Defining channels
    const emailChannel: Channel<Parameters<typeof sendEmail>[0]> = {
      send: (opts) => sendEmail(opts),
      buildPayload: (order) => ({
        email: order.user.email,
        subject:
          order.brand === brandEnum[0]
            ? PINCH_EMAILS.orderPrepare.subject
            : BOB_EMAILS.orderPrepare.subject,
        template:
          order.brand === brandEnum[0]
            ? PINCH_EMAILS.orderPrepare.template
            : BOB_EMAILS.orderPrepare.template,
        context: {
          previewText:
            order.brand === brandEnum[0]
              ? PINCH_EMAILS.orderPrepare.previewText
              : BOB_EMAILS.orderPrepare.previewText,
          orderNo: order.orderNumber as string,
          customerName: `${order.user.firstName || ''} ${
            order.user.lastName || ''
          }`.trim(),
        },
        brand,
      }),
      onError: (order, err) =>
        console.error(`[${brand}] Email failed for ${order.orderNumber}`, err),
    };

    // Generic SMS channel factory
    const makeSmsChannel = (
      bodyTemplate: (order: IOrder) => string
    ): Channel<{ phone: string; body: string }> => ({
      send: ({ phone, body }) => sendSms(body, phone),
      buildPayload: (order) => {
        const phone =
          order.recipInfo?.contact ||
          order.delivery.address.phone ||
          order.user.phone;
        return { phone, body: bodyTemplate(order) };
      },
      onError: (order, err) =>
        console.error(
          `[${brandDisplayName}] SMS failed for ${order.orderNumber}`,
          err
        ),
    });

    // SMS scenarios
    const smsChannelCorporate = makeSmsChannel((order) => {
      const addr = formatAddress(order.delivery.address);
      const date = formatShortDate(order.delivery.date as Date);
      const timeRange = order.delivery.collectionTime;
      const url = makeStatusUrl(brand, order.id);
      return `<${brandDisplayName}> Your delivery from Jane Doe will arrive at ${addr} on ${date} between ${timeRange}. Details at: ${url}`;
    });

    const smsChannelRegular = makeSmsChannel((order) => {
      const addr = formatAddress(order.delivery.address);
      const date = formatShortDate(order.delivery.date as Date);
      const timeRange = order.delivery.collectionTime;
      const url = makeStatusUrl(brand, order.id);
      return `<${brandDisplayName}> Your delivery will arrive at ${addr} on ${date} between ${timeRange}. Details at: ${url}`;
    });

    const smsChannelSelfCollect = makeSmsChannel((order) => {
      const date = formatShortDate(order.delivery.date as Date);
      const timeRange = order.delivery.collectionTime;
      return `<${brandDisplayName}> Collect order #${order.orderNumber} on ${date} ${timeRange}. Contact reception or call +65-88623327 upon arrival`;
    });

    const smsChannelSurvey = makeSmsChannel((order) => {
      const accountName = order.user.firstName || order.recipInfo?.name || '';
      return `<${brandDisplayName}> Hi ${accountName}, how was your experience yesterday? Share your feedback on Google: https://bit.ly/2VG9Md5. Get 10% off your next purchase with code WELCOMEBACK.`;
    });

    // 1) Next-day EMAIL for all paid orders, both brands
    await dispatchForOrders(
      {
        'delivery.date': { $gte: start, $lt: end },
        paid: true,
        brand,
        status: { $ne: CANCELLED },
      },
      [emailChannel]
    );

    if (!smsEnabled) {
      console.log(`[${brand}] SMS is disabled; skipping SMS flows`);
      // eslint-disable-next-line no-continue
      continue;
    }

    // 2) Next-day SMS: corporate orders
    await dispatchForOrders(
      {
        'delivery.date': { $gte: start, $lt: end },
        paid: true,
        brand,
        corporate: true,
        status: { $ne: CANCELLED },
      },
      [smsChannelCorporate]
    );

    // 3) Next-day SMS: regular, non–self-collect orders
    await dispatchForOrders(
      {
        'delivery.date': { $gte: start, $lt: end },
        paid: true,
        brand,
        corporate: false,
        'delivery.method': { $ne: selfCollect._id },
        status: { $ne: CANCELLED },
      },
      [smsChannelRegular]
    );

    // 4) Next-day SMS: self-collect orders
    await dispatchForOrders(
      {
        'delivery.date': { $gte: start, $lt: end },
        paid: true,
        brand,
        corporate: false,
        'delivery.method': selfCollect._id,
        status: { $ne: CANCELLED },
      },
      [smsChannelSelfCollect]
    );

    // 5) Survey SMS for orders delivered yesterday
    const { start: yStart, end: yEnd } = getYesterdayUtcRange();
    await dispatchForOrders(
      {
        'delivery.date': { $gte: yStart, $lt: yEnd },
        paid: true,
        brand,
        status: { $ne: CANCELLED },
      },
      [smsChannelSurvey]
    );

    // 6) Sending Anniversary SMS to customer 1 year after their latest purchase
    try {
      const { start: pStart, end: pEnd } = getOneYearAgoWindow();
      const anniversaryUsers = await Order.aggregate([
        {
          $match: {
            paid: true,
            brand,
            status: { $ne: CANCELLED },
          },
        },
        {
          $group: {
            _id: '$user',
            lastCreated: { $max: '$createdAt' },
          },
        },
        {
          $match: {
            lastCreated: { $gte: pStart, $lt: pEnd },
          },
        },
      ]);

      const userIds = anniversaryUsers.map((doc) => doc._id);
      if (!userIds.length) {
        console.log('No anniversary users found.');
        return;
      }

      // Fetch users with valid phone numbers
      const users = await User.find({
        _id: { $in: userIds },
        phone: { $exists: true, $ne: null },
      })
        .select('phone')
        .lean();

      if (!users.length) {
        console.log('No users with valid phone numbers found.');
        return;
      }

      // Send one SMS per user
      await Promise.all(
        users.map(async ({ _id, phone, brand: brandName }) => {
          try {
            let body = ''; // TODO: Add Pinch SMS content here
            if (brandName === brandEnum[0]) {
              body = '';
            } else {
              body = `<BobTheBakerBoy> It's been a year! We missed you. Use coupon AYEARWBOB10 to celebrate again ♥️`;
            }
            await sendSms(body, phone);
            console.log(`Sent to ${phone} (user ${_id})`);
          } catch (err) {
            console.error(`SMS failed for user ${_id} (${phone}):`, err);
          }
        })
      );
    } catch (err) {
      console.error('Anniversary CRON error:', err);
    }
  }
});
