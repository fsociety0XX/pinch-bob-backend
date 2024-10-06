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
} from '@src/controllers/userController';

const userRouter = express.Router();
userRouter.use(protect, roleRistriction(Role.ADMIN));

userRouter.route('/addToWishlist').patch(addToWishlist);
userRouter.route('/').get(getAllUser).post(createUser);
userRouter.route('/:id').get(getOneUser).patch(updateUser).delete(deleteUser);

export default userRouter;
