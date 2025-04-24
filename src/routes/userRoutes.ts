import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  createUser,
  deleteUser,
  getAllUser,
  getOneUser,
  updateUser,
  addToWishlist,
  addToCart,
  migrateUsers,
  deduplicateUsersByEmail,
  deduplicateUsersByPhone,
} from '@src/controllers/userController';
import {
  ADD_TO_CART,
  ADD_TO_WISHLIST,
  MIGRATE,
} from '@src/constants/routeConstants';

const userRouter = express.Router();
userRouter.use(protect);
userRouter.route(ADD_TO_WISHLIST).patch(addToWishlist);
userRouter.route(ADD_TO_CART).patch(addToCart);
userRouter.use(roleRistriction(Role.ADMIN));

userRouter.route('/').get(getAllUser).post(createUser);
userRouter.route('/:id').get(getOneUser).patch(updateUser).delete(deleteUser);

// MIGRATION API
userRouter.route(MIGRATE).post(migrateUsers);

// REMOVE DUPLICATE ACCOUNTS
userRouter.route('/merge-duplicates-email').post(deduplicateUsersByEmail);
userRouter.route('/merge-duplicates-phone').post(deduplicateUsersByPhone);

export default userRouter;
