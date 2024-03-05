import CollectionTime from '@src/models/collectionTimeModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createCollectionTime = createOne(CollectionTime);
export const updateCollectionTime = updateOne(CollectionTime);
export const deleteCollectionTime = deleteOne(CollectionTime);
export const getOneCollectionTime = getOne(CollectionTime);
export const getAllCollectionTime = getAll(CollectionTime);
