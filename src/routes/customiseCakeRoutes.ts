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
  addRefImages,
  removeRefImage,
} from '@src/controllers/customiseCakeController';
import uploadImage from '@src/utils/uploadImage';
import {
  SEND_PAYMENT_EMAIL,
  SEND_PAYMENT_SMS,
  UPDATE_REF_IMG,
} from '@src/constants/routeConstants';

const customiseCakeRouter = express.Router();

customiseCakeRouter
  .route('/')
  .post(
    uploadImage(process.env.AWS_BUCKET_CUSTOMER_REQUEST_PATH!).array(
      'images',
      10
    ),
    submitCustomerForm
  );

customiseCakeRouter.use(protect);
customiseCakeRouter.use(roleRistriction(Role.ADMIN));

customiseCakeRouter.route('/').get(getAllCustomiseForm);

customiseCakeRouter
  .route('/:id')
  .patch(submitAdminForm) // Removed upload middleware since images are handled by dedicated APIs
  .get(getOneCustomiseCakeForm);

// Image management routes - supports both additionalRefImages and baseColourImg
customiseCakeRouter
  .route(UPDATE_REF_IMG)
  .post(
    uploadImage(process.env.AWS_BUCKET_CUSTOMER_REQUEST_PATH!).any(), // Use .any() to handle flexible field names
    addRefImages
  )
  .delete(removeRefImage);

customiseCakeRouter.route(SEND_PAYMENT_SMS).get(sendPaymentSms);
customiseCakeRouter.route(SEND_PAYMENT_EMAIL).get(sendPaymentEmail);

export default customiseCakeRouter;
