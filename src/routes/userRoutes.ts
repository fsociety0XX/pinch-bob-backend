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
} from '@src/controllers/userController';

const userRouter = express.Router();
userRouter.use(protect);
userRouter.route('/addToWishlist/:id').patch(addToWishlist);
userRouter.route('/addToCart/:id').patch(addToCart);
userRouter.use(roleRistriction(Role.ADMIN));

userRouter.route('/').get(getAllUser).post(createUser);
userRouter.route('/:id').get(getOneUser).patch(updateUser).delete(deleteUser);

export default userRouter;
