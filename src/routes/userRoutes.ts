import express from 'express';
import { signup } from '@src/controllers/authController';
import uploadImage from '@src/utils/uploadImage';
import { SIGN_UP } from '@src/constants/routeConstants';

const userRouter = express.Router();

userRouter.post(
  SIGN_UP,
  uploadImage(process.env.AWS_BUCKET_PROFILE_PATH!).single('profile'),
  signup
);

export default userRouter;
