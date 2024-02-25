import Size from '@src/models/sizeModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createSize = createOne(Size);
export const updateSize = updateOne(Size);
export const deleteSize = deleteOne(Size);
export const getOneSize = getOne(Size);
export const getAllSize = getAll(Size);
