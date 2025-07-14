// utils/activityLog/activityLogger.ts
import ActivityLog from '@src/models/activityLogModel';

interface UserInfo {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface LogActivityOptions {
  user: UserInfo;
  action: string;
  module: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  brand?: string;
}

/**
 * Passively logs user activity for auditing.
 */
const logActivity = async ({
  user,
  action,
  module,
  targetId,
  metadata = {},
  brand = '',
}: LogActivityOptions): Promise<void> => {
  if (!user || !user._id || !action || !module || !targetId) {
    console.warn('Invalid logActivity call: missing required fields');
    return;
  }

  try {
    await ActivityLog.create({
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      action,
      module,
      targetId,
      metadata,
      brand,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

export const ActivityActions = {
  UPDATE_ORDER: 'UPDATE_ORDER',
  DELETE_ORDER: 'DELETE_ORDER',

  UPDATE_DELIVERY: 'UPDATE_DELIVERY',
  DELETE_DELIVERY: 'DELETE_DELIVERY',

  UPDATE_PRODUCT: 'UPDATE_PRODUCT',
  DELETE_PRODUCT: 'DELETE_PRODUCT',

  UPDATE_COUPON: 'UPDATE_COUPON',
  DELETE_COUPON: 'DELETE_COUPON',

  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',

  // Add more as needed
} as const;

export type ActivityAction =
  (typeof ActivityActions)[keyof typeof ActivityActions];

export default logActivity;
