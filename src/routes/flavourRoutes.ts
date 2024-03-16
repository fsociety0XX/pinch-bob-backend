import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  createFlavour,
  deleteFlavour,
  getAllFlavour,
  getOneFlavour,
  updateFlavour,
} from '@src/controllers/flavourController';

const flavourRouter = express.Router();

flavourRouter.route('/').get(getAllFlavour);

flavourRouter.use(protect, roleRistriction(Role.ADMIN));
flavourRouter.route('/').post(createFlavour);

flavourRouter
  .route('/:id')
  .get(getOneFlavour)
  .patch(updateFlavour)
  .delete(deleteFlavour);

export default flavourRouter;
