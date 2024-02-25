import Colour from '@src/models/colourModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createColour = createOne(Colour);
export const updateColour = updateOne(Colour);
export const deleteColour = deleteOne(Colour);
export const getOneColour = getOne(Colour);
export const getAllColour = getAll(Colour);
