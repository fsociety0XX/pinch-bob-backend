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
const largePayloadParser = express.json({ limit: '100mb' });
userRouter.route(MIGRATE).post(largePayloadParser, migrateUsers);

export default userRouter;
