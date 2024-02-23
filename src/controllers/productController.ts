import Product from '@src/models/productModel';
import {
  createOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createProduct = createOne(Product);
export const updateProduct = updateOne(Product);
export const getOneProduct = getOne(Product);
export const getAllProduct = getAll(Product);
