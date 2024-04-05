import SuperCategory from '@src/models/superCategoryModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createSuperCategory = createOne(SuperCategory);
export const updateSuperCategory = updateOne(SuperCategory);
export const deleteSuperCategory = deleteOne(SuperCategory);
export const getOneSuperCategory = getOne(SuperCategory);
export const getAllSuperCategory = getAll(SuperCategory, ['name']);
