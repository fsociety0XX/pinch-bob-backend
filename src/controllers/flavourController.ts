import Flavour from '@src/models/flavourModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createFlavour = createOne(Flavour);
export const updateFlavour = updateOne(Flavour);
export const deleteFlavour = deleteOne(Flavour);
export const getOneFlavour = getOne(Flavour);
export const getAllFlavour = getAll(Flavour);
