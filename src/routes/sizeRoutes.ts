import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  createSize,
  deleteSize,
  getAllSize,
  getOneSize,
  updateSize,
} from '@src/controllers/sizeController';

const sizeRouter = express.Router();
sizeRouter.use(protect, roleRistriction(Role.ADMIN));

sizeRouter.route('/').get(getAllSize).post(createSize);

sizeRouter.route('/:id').get(getOneSize).patch(updateSize).delete(deleteSize);

export default sizeRouter;
