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
  getFbtAlsoLike,
} from '@src/controllers/productController';
import { Role } from '@src/types/customTypes';
import uploadImage from '@src/utils/uploadImage';
import { FBT_ALSO_LIKE } from '@src/constants/routeConstants';

const productRouter = express.Router();

productRouter
  .route('/globalSearch')
  .get(checkGlobalSearchParams, getAllProduct);

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

productRouter.route(FBT_ALSO_LIKE).get(getFbtAlsoLike);

export default productRouter;
