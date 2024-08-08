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
import uploadImage from '@src/utils/uploadImage';

const superCategoryRouter = express.Router();

superCategoryRouter.route('/').get(getAllSuperCategory); // No protection for get all data

superCategoryRouter.use(protect, roleRistriction(Role.ADMIN));
superCategoryRouter
  .route('/')
  .post(
    uploadImage(process.env.AWS_BUCKET_PRODUCT_PATH!).single('image'),
    createSuperCategory
  );

superCategoryRouter
  .route('/:id')
  .get(getOneSuperCategory)
  .patch(updateSuperCategory)
  .delete(deleteSuperCategory);

export default superCategoryRouter;
