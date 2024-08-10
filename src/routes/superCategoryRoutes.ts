import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  createSuperCategory,
  deleteSuperCategory,
  getAllSuperCategory,
  getOneSuperCategory,
  updateSuperCategory,
} from '@src/controllers/superCategoryController';

const superCategoryRouter = express.Router();

superCategoryRouter.route('/').get(getAllSuperCategory); // No protection for get all data

superCategoryRouter.use(protect, roleRistriction(Role.ADMIN));
superCategoryRouter.route('/').post(createSuperCategory);

superCategoryRouter
  .route('/:id')
  .get(getOneSuperCategory)
  .patch(updateSuperCategory)
  .delete(deleteSuperCategory);

export default superCategoryRouter;
