import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  submitAdminForm,
  submitCustomerForm,
} from '@src/controllers/customiseCakeController';
import uploadImage from '@src/utils/uploadImage';

const customiseCakeRouter = express.Router();

customiseCakeRouter
  .route('/')
  .post(
    uploadImage(process.env.AWS_BUCKET_CUSTOMER_REQUEST_PATH!).array(
      'images',
      5
    ),
    submitCustomerForm
  );

customiseCakeRouter.use(protect);
customiseCakeRouter.use(roleRistriction(Role.ADMIN));

customiseCakeRouter
  .route('/:id')
  .patch(
    uploadImage(process.env.AWS_BUCKET_CUSTOMER_REQUEST_PATH!).single(
      'baseColourImg'
    ),
    submitAdminForm
  );

export default customiseCakeRouter;
