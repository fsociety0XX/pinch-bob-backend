import Category from '@src/models/categoryModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createCategory = createOne(Category);
export const updateCategory = updateOne(Category);
export const deleteCategory = deleteOne(Category);
export const getOneCategory = getOne(Category);
export const getAllCategory = getAll(Category, ['name']);
