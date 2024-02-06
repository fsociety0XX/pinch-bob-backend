import express from 'express';
import {
  changePassword,
  forgotPassword,
  protect,
  resetPassword,
  // roleRistriction,
  signin,
  signup,
} from '@src/controllers/authController';
import uploadImage from '@src/utils/uploadImage';
import {
  CHANGE_PASSWORD,
  FORGOT_PASSWORD,
  RESET_PASSWORD,
  SIGN_IN,
  SIGN_UP,
} from '@src/constants/routeConstants';
// import { Role } from '@src/types/customTypes';

const userRouter = express.Router();

// Auth routes
userRouter.post(
  SIGN_UP,
  uploadImage(process.env.AWS_BUCKET_PROFILE_PATH!).single('profile'),
  signup
);
userRouter.post(SIGN_IN, signin);
userRouter.post(FORGOT_PASSWORD, forgotPassword);
userRouter.patch(RESET_PASSWORD, resetPassword);

// User routes
userRouter.patch(
  CHANGE_PASSWORD,
  protect,
  // roleRistriction(Role.CUSTOMER), //TODO
  changePassword
);
userRouter.get('/test', (req, res) => {
  res.send({
    status: 'success',
  });
});

export default userRouter;
