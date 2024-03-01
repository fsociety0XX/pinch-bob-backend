import express from 'express';
import { protect } from '@src/controllers/authController';
import {
  appendUserIdInReqBody,
  appendUserIdInReqQuery,
  authenticateAddressAccess,
  createAddress,
  deleteAddress,
  getAllAddress,
  getOneAddress,
  updateAddress,
} from '@src/controllers/addressController';

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
  .delete(authenticateAddressAccess, deleteAddress);

export default addressRouter;
