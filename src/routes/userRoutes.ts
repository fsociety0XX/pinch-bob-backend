import express from 'express';
import {
  changePassword,
  forgotPassword,
  protect,
  resetPassword,
  sendOtp,
  signin,
  signup,
  verifyOtp,
} from '@src/controllers/authController';
import uploadImage from '@src/utils/uploadImage';
import {
  CHANGE_PASSWORD,
  FORGOT_PASSWORD,
  RESET_PASSWORD,
  SEND_OTP,
  SIGN_IN,
  SIGN_UP,
  VERIFY_OTP,
} from '@src/constants/routeConstants';

const userRouter = express.Router();

// Auth routes

userRouter.post(SEND_OTP, sendOtp);
userRouter.post(VERIFY_OTP, verifyOtp);
userRouter.post(
  SIGN_UP,
  uploadImage(process.env.AWS_BUCKET_PROFILE_PATH!).single('photo'),
  signup
);
userRouter.post(SIGN_IN, signin);
userRouter.post(FORGOT_PASSWORD, forgotPassword);
userRouter.patch(RESET_PASSWORD, resetPassword);

// User routes
userRouter.patch(CHANGE_PASSWORD, protect, changePassword);

export default userRouter;
