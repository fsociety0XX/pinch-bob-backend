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
import uploadImage from '@src/utils/uploadImage';

const categoryRouter = express.Router();

categoryRouter.route('/').get(getAllCategory); // No protection for get all data
categoryRouter.route('/:id').get(getOneCategory);

categoryRouter.use(protect, roleRistriction(Role.ADMIN));
categoryRouter
  .route('/')
  .post(
    uploadImage(process.env.AWS_BUCKET_PRODUCT_PATH!).single('image'),
    createCategory
  );

categoryRouter.route('/:id').patch(updateCategory).delete(deleteCategory);

export default categoryRouter;
