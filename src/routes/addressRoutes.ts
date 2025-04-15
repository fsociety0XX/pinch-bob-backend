import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import {
  authenticateAddressAccess,
  createAddress,
  deleteAddress,
  getAllAddress,
  getOneAddress,
  migrateAddress,
  updateAddress,
} from '@src/controllers/addressController';
import {
  appendUserIdInReqBody,
  appendUserIdInReqQuery,
} from '@src/utils/middlewares';
import { MIGRATE } from '@src/constants/routeConstants';
import { Role } from '@src/types/customTypes';

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

// MIGRATION API
addressRouter
  .use(roleRistriction(Role.ADMIN))
  .route(MIGRATE)
  .post(migrateAddress);

export default addressRouter;
