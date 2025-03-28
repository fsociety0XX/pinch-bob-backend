import express from 'express';
import { protect } from '@src/controllers/authController';
import {
  authenticateAddressAccess,
  createAddress,
  deleteAddress,
  getAllAddress,
  getOneAddress,
  updateAddress,
} from '@src/controllers/addressController';
import {
  appendUserIdInReqBody,
  appendUserIdInReqQuery,
} from '@src/utils/middlewares';

const addressRouter = express.Router();
addressRouter.use(protect);

addressRouter
  .route('/')
  .get(appendUserIdInReqQuery, getAllAddress)
  .post(appendUserIdInReqBody, createAddress);

addressRouter
  .route('/:id')
  .get(authenticateAddressAccess, getOneAddress)
  .patch(authenticateAddressAccess, updateAddress)
  .patch(authenticateAddressAccess, deleteAddress);

export default addressRouter;
