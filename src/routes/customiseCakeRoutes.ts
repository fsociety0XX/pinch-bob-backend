import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  getAllCustomiseForm,
  getOneCustomiseCakeForm,
  sendPaymentEmail,
  sendPaymentSms,
  submitAdminForm,
  submitCustomerForm,
} from '@src/controllers/customiseCakeController';
import uploadImage from '@src/utils/uploadImage';
import {
  SEND_PAYMENT_EMAIL,
  SEND_PAYMENT_SMS,
} from '@src/constants/routeConstants';

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
    uploadImage(process.env.AWS_BUCKET_CUSTOMER_REQUEST_PATH!).fields([
      { name: 'images', maxCount: 10 },
      { name: 'baseColourImg', maxCount: 1 },
    ]),
    submitAdminForm
  )
  .get(getOneCustomiseCakeForm);

customiseCakeRouter.route(SEND_PAYMENT_SMS).get(sendPaymentSms);
customiseCakeRouter.route(SEND_PAYMENT_EMAIL).get(sendPaymentEmail);

export default customiseCakeRouter;
