import express from 'express';
import {
  changePassword,
  forgotPassword,
  fetchReviews,
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
import { appendDefaultUserRoleInReq } from '@src/utils/middlewares';

const authRouter = express.Router();

// Auth routes
authRouter.route('/reviews').get(fetchReviews);
authRouter.post(SEND_OTP, sendOtp);
authRouter.post(VERIFY_OTP, verifyOtp);
authRouter.post(
  SIGN_UP,
  uploadImage(process.env.AWS_BUCKET_PROFILE_PATH!).single('photo'),
  appendDefaultUserRoleInReq,
  signup
);
authRouter.post(SIGN_IN, signin);
authRouter.post(FORGOT_PASSWORD, forgotPassword);
authRouter.patch(RESET_PASSWORD, resetPassword);

// User routes
authRouter.patch(CHANGE_PASSWORD, protect, changePassword);

export default authRouter;
