import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import uploadImage from '@src/utils/uploadImage';
import {
  createSubCategory,
  deleteSubCategory,
  getAllSubCategory,
  getOneSubCategory,
  updateSubCategory,
} from '@src/controllers/subCategoryController';

const subCategoryRouter = express.Router();

subCategoryRouter.route('/').get(getAllSubCategory); // No protection for get all data

subCategoryRouter.use(protect, roleRistriction(Role.ADMIN));
subCategoryRouter
  .route('/')
  .post(
    uploadImage(process.env.AWS_BUCKET_PRODUCT_PATH!).single('image'),
    createSubCategory
  );

subCategoryRouter
  .route('/:id')
  .get(getOneSubCategory)
  .patch(
    uploadImage(process.env.AWS_BUCKET_PRODUCT_PATH!).single('image'),
    updateSubCategory
  )
  .delete(deleteSubCategory);

export default subCategoryRouter;
