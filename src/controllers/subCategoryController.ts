import SubCategory from '@src/models/subCategoryModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createSubCategory = createOne(SubCategory);
export const updateSubCategory = updateOne(SubCategory);
export const deleteSubCategory = deleteOne(SubCategory);
export const getOneSubCategory = getOne(SubCategory);
export const getAllSubCategory = getAll(SubCategory);
