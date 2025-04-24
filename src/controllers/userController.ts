/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Added only for migration controller function and need to remove it later
import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import AppError from '@src/utils/appError';
import User, { IUser } from '@src/models/userModel';
import catchAsync from '@src/utils/catchAsync';
import { StatusCode } from '@src/types/customTypes';
import { NO_DATA_FOUND } from '@src/constants/messages';
import { IRequestWithUser } from './authController';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';
import Order from '@src/models/orderModel';
import CustomiseCake from '@src/models/customiseCakeModel';
import Address from '@src/models/addressModel';

export const createUser = createOne(User);
export const updateUser = updateOne(User);
export const deleteUser = deleteOne(User);
export const getOneUser = getOne(User);
export const getAllUser = getAll(User);

export const addToWishlist = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    const doc = await User.findByIdAndUpdate(
      req.user?._id,
      { $push: { wishlist: req.params.id } },
      { new: true }
    );
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
    return false;
  }
);

export const addToCart = catchAsync(
  async (req: IRequestWithUser, res: Response, next: NextFunction) => {
    const {
      product,
      price,
      quantity,
      size,
      pieces,
      flavour,
      colour,
      card,
      refImage,
      msg,
      specialInstructions,
      fondantName,
      fondantNumber,
      moneyPulling,
      address,
    } = req.body;

    const cart = {
      product,
      price,
      quantity,
      size,
      pieces,
      flavour,
      colour,
      card,
      refImage,
      msg,
      specialInstructions,
      fondantName,
      fondantNumber,
      moneyPulling,
      address,
    };

    const doc = await User.findByIdAndUpdate(
      req.user?._id,
      { $push: { cart } },
      { new: true }
    );

    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });

    return false;
  }
);

export const migrateUsers = catchAsync(async (req: Request, res: Response) => {
  const { users } = req.body || [];
  const failedIds: number[] = [];
  const bulkOps = await Promise.all(
    users.map(async (user: IUser) => ({ insertOne: { document: user } }))
  );

  const result = await User.bulkWrite(bulkOps, { ordered: false });

  if (result?.writeErrors && result.writeErrors?.length > 0) {
    result.writeErrors.forEach((err: any) => {
      failedIds.push(users[err.index]?.sqlId);
    });
  }

  res.status(200).json({
    message: 'Migration completed',
    failedIds,
  });
});

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const deduplicateUsersByEmail = async () => {
  const brands = ['pinch', 'bob'];

  // eslint-disable-next-line no-restricted-syntax
  for (const brand of brands) {
    console.log(`\n🔍 Processing brand: ${brand}`);

    // Step 1: Get all users for brand
    // eslint-disable-next-line no-await-in-loop
    const users = await User.find({ brand });
    const userGroups: Record<string, mongoose.Document[]> = {};

    // Step 2: Group users by email
    users.forEach((user) => {
      const key = user.email?.toLowerCase();
      if (!key) return;

      if (!userGroups[key]) userGroups[key] = [];
      userGroups[key].push(user);
    });

    // Step 3: Process duplicates
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const email in userGroups) {
      const group = userGroups[email];
      // eslint-disable-next-line no-continue
      if (group.length <= 1) continue; // no duplicates

      // Sort users by createdAt (or _id timestamp)
      const sorted = group.sort((a, b) => {
        return (
          (a.createdAt?.getTime?.() || a._id.getTimestamp().getTime()) -
          (b.createdAt?.getTime?.() || b._id.getTimestamp().getTime())
        );
      });

      const primaryUser = sorted[0];
      const duplicateUsers = sorted.slice(1);
      const duplicateIds = duplicateUsers.map((u) => u._id);

      console.log(
        `📌 Merging ${duplicateIds.length} duplicates for email: ${email}`
      );
      console.log(`   → Keeping user: ${primaryUser._id}`);

      // Update references in all related collections
      // eslint-disable-next-line no-await-in-loop
      await Promise.all([
        Order.updateMany(
          { user: { $in: duplicateIds } },
          { $set: { user: primaryUser._id } }
        ),
        CustomiseCake.updateMany(
          { user: { $in: duplicateIds } },
          { $set: { user: primaryUser._id } }
        ),
        Address.updateMany(
          { user: { $in: duplicateIds } },
          { $set: { user: primaryUser._id } }
        ),
      ]);

      // Optionally: merge wishlist/cart/coupons/etc. logic here

      // Delete duplicate users
      // eslint-disable-next-line no-await-in-loop
      await User.deleteMany({ _id: { $in: duplicateIds } });

      console.log(`✅ Merged and cleaned up users with email: ${email}`);
    }
  }

  console.log('\n🎉 Duplicate cleanup complete for all brands.');
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const deduplicateUsersByPhone = async () => {
  const brands = ['pinch', 'bob'];

  // eslint-disable-next-line no-restricted-syntax
  for (const brand of brands) {
    console.log(`\n🔍 Processing brand: ${brand}`);

    // Step 1: Find phones that occur more than once
    // eslint-disable-next-line no-await-in-loop
    const duplicates = await User.aggregate([
      // eslint-disable-next-line no-dupe-keys
      { $match: { brand, phone: { $exists: true, $ne: null, $ne: '' } } },
      {
        $group: { _id: '$phone', count: { $sum: 1 }, users: { $push: '$_id' } },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    console.log(
      `📱 Found ${duplicates.length} duplicate phone numbers in brand ${brand}`
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const dup of duplicates) {
      const phone = dup._id;
      const userIds = dup.users;

      const primaryUserId = userIds[0];
      const duplicateUserIds = userIds.slice(1);

      console.log(
        `\n➡️ Phone: ${phone} - Keeping user ${primaryUserId}, removing ${duplicateUserIds.length} duplicates`
      );

      // Update references in all related models
      // eslint-disable-next-line no-await-in-loop
      await Order.updateMany(
        { brand, user: { $in: duplicateUserIds } },
        { $set: { user: primaryUserId } }
      );

      // eslint-disable-next-line no-await-in-loop
      await CustomiseCake.updateMany(
        { brand, user: { $in: duplicateUserIds } },
        { $set: { user: primaryUserId } }
      );

      // eslint-disable-next-line no-await-in-loop
      await Address.updateMany(
        { brand, user: { $in: duplicateUserIds } },
        { $set: { user: primaryUserId } }
      );

      // Delete duplicate users
      // eslint-disable-next-line no-await-in-loop
      await User.deleteMany({ _id: { $in: duplicateUserIds } });

      console.log(
        `✅ Merged and deleted ${duplicateUserIds.length} users with phone ${phone}`
      );
    }
  }

  console.log(`\n🎉 Phone-based deduplication completed.`);
};
