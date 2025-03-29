import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  getAllCustomiseForm,
  sendPaymentLink,
  submitAdminForm,
  submitCustomerForm,
  updateCustomiseCakeForm,
} from '@src/controllers/customiseCakeController';
import uploadImage from '@src/utils/uploadImage';
import { SEND_PAYMENT_LINK, UPDATE_FORM } from '@src/constants/routeConstants';

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

customiseCakeRouter.route('/').get(getAllCustomiseForm);

customiseCakeRouter
  .route('/:id')
  .patch(
    uploadImage(process.env.AWS_BUCKET_CUSTOMER_REQUEST_PATH!).single(
      'baseColourImg'
    ),
    submitAdminForm
  );

customiseCakeRouter.route(UPDATE_FORM).patch(
  uploadImage(process.env.AWS_BUCKET_CUSTOMER_REQUEST_PATH!).fields([
    { name: 'images', maxCount: 5 },
    { name: 'baseColourImg', maxCount: 1 },
  ]),
  updateCustomiseCakeForm
);

customiseCakeRouter.route(SEND_PAYMENT_LINK).get(sendPaymentLink);

export default customiseCakeRouter;
