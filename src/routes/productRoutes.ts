import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import {
  createProduct,
  deleteProduct,
  getAllProduct,
  getOneProduct,
  getOneProductViaSlug,
  updateProduct,
  checkGlobalSearchParams,
  globalSearch,
} from '@src/controllers/productController';
import { Role } from '@src/types/customTypes';
import uploadImage from '@src/utils/uploadImage';

const productRouter = express.Router();

productRouter.route('/globalSearch').get(checkGlobalSearchParams, globalSearch);

productRouter
  .route('/')
  .post(
    protect,
    roleRistriction(Role.ADMIN),
    uploadImage(process.env.AWS_BUCKET_PRODUCT_PATH!).array('images', 5),
    createProduct
  )
  .get(getAllProduct);

productRouter
  .route('/:id')
  .get(getOneProduct)
  .patch(
    protect,
    roleRistriction(Role.ADMIN),
    uploadImage(process.env.AWS_BUCKET_PRODUCT_PATH!).array('images', 5),
    updateProduct
  )
  .delete(protect, roleRistriction(Role.ADMIN), deleteProduct);

productRouter.route('/slug/:slug').get(getOneProductViaSlug);

export default productRouter;
