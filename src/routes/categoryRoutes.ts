import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import {
  createCategory,
  deleteCategory,
  getAllCategory,
  getOneCategory,
  updateCategory,
} from '@src/controllers/categoryController';
import { Role } from '@src/types/customTypes';

const categoryRouter = express.Router();
categoryRouter.use(protect, roleRistriction(Role.ADMIN));

categoryRouter.route('/').get(getAllCategory).post(createCategory);

categoryRouter
  .route('/:id')
  .get(getOneCategory)
  .patch(updateCategory)
  .delete(deleteCategory);

export default categoryRouter;
