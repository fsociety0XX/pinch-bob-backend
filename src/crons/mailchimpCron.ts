/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import cron from 'node-cron';
import mailchimpClient from '@mailchimp/mailchimp_marketing';
import crypto from 'crypto';
import Order from '@src/models/orderModel';
import User from '@src/models/userModel';
import { PRODUCTION } from '@src/constants/static';

const { MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_LIST_ID } =
  process.env;

// if (!MAILCHIMP_API_KEY || !MAILCHIMP_SERVER_PREFIX || !MAILCHIMP_LIST_ID) {
//   throw new Error('Mailchimp environment variables are not set');
// }

// Configure Mailchimp SDK
mailchimpClient.setConfig({
  apiKey: MAILCHIMP_API_KEY,
  server: MAILCHIMP_SERVER_PREFIX,
});

/**
 * Get UTC-midnight timestamp for exactly 14 days ago.
 */
function get14DaysAgoUtcMidnight(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 14,
      0,
      0,
      0
    )
  );
}

/**
 * Compute MD5 hash of lowercase email for Mailchimp subscriber hashing.
 */
function md5(email: string): string {
  return crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
}

/**
 * Tag a single email in Mailchimp with the given tag using the official SDK.
 */
async function tagEmail(email: string, tag: string): Promise<void> {
  const subscriberHash = md5(email);
  try {
    await mailchimpClient.lists.updateListMemberTags(
      MAILCHIMP_LIST_ID!,
      subscriberHash,
      { tags: [{ name: tag, status: 'active' }] }
    );
    console.log(`Tagged ${email} with "${tag}"`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error(
      `Mailchimp tagging failed for ${email} [${tag}]:`,
      err.response?.status,
      err.response?.body || err
    );
  }
}

/**
 * Main job: queries MongoDB for qualifying users and tags them in Mailchimp.
 */
async function syncMailchimpTags(): Promise<void> {
  const start14 = get14DaysAgoUtcMidnight();

  // Case 1: exactly 2 orders total, last delivery within 14 days
  const secondAgg = await Order.aggregate([
    {
      $group: {
        _id: '$user',
        totalOrders: { $sum: 1 },
        lastDelivery: { $max: '$delivery.date' },
      },
    },
    { $match: { totalOrders: 2, lastDelivery: { $gte: start14 } } },
  ]);
  const secondIds = secondAgg.map((r) => r._id);
  const secondUsers = await User.find({ _id: { $in: secondIds } })
    .select('email')
    .lean();
  for (const u of secondUsers) {
    await tagEmail(u.email, 'secondpurchase');
  }

  // Case 2: exactly 4 orders total, last delivery within 14 days
  const fourthAgg = await Order.aggregate([
    {
      $group: {
        _id: '$user',
        totalOrders: { $sum: 1 },
        lastDelivery: { $max: '$delivery.date' },
      },
    },
    { $match: { totalOrders: 4, lastDelivery: { $gte: start14 } } },
  ]);
  const fourthIds = fourthAgg.map((r) => r._id);
  const fourthUsers = await User.find({ _id: { $in: fourthIds } })
    .select('email')
    .lean();
  for (const u of fourthUsers) {
    await tagEmail(u.email, 'fourthpurchase');
  }

  // Case 3: total order value >= $500, last delivery within 14 days
  const valueAgg = await Order.aggregate([
    {
      $group: {
        _id: '$user',
        totalValue: { $sum: '$pricingSummary.total' },
        lastDelivery: { $max: '$delivery.date' },
      },
    },
    { $match: { totalValue: { $gte: 500 }, lastDelivery: { $gte: start14 } } },
  ]);
  const valueIds = valueAgg.map((r) => r._id);
  const valueUsers = await User.find({ _id: { $in: valueIds } })
    .select('email')
    .lean();
  for (const u of valueUsers) {
    await tagEmail(u.email, '500purchase');
  }
}

// Schedule the sync to run daily at midnight UTC
cron.schedule('0 0 * * *', () => {
  if (process.env.NODE_ENV !== PRODUCTION) return;

  syncMailchimpTags().catch((err) =>
    console.error('Mailchimp cron error', err)
  );
});
