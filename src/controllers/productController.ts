import Product from '@src/models/productModel';
import { createOne, updateOne } from '@src/utils/factoryHandler';

export const createProduct = createOne(Product);
export const updateProduct = updateOne(Product);
