import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  createColour,
  deleteColour,
  getAllColour,
  getOneColour,
  updateColour,
} from '@src/controllers/colourController';

const colourRouter = express.Router();
colourRouter.use(protect, roleRistriction(Role.ADMIN));

colourRouter.route('/').get(getAllColour).post(createColour);

colourRouter
  .route('/:id')
  .get(getOneColour)
  .patch(updateColour)
  .delete(deleteColour);

export default colourRouter;