import Pieces from '@src/models/piecesModel';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createPieces = createOne(Pieces);
export const updatePieces = updateOne(Pieces);
export const deletePieces = deleteOne(Pieces);
export const getOnePieces = getOne(Pieces);
export const getAllPieces = getAll(Pieces);
