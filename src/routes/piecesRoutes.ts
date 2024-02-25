import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  createPieces,
  deletePieces,
  getAllPieces,
  getOnePieces,
  updatePieces,
} from '@src/controllers/piecesController';

const piecesRouter = express.Router();
piecesRouter.use(protect, roleRistriction(Role.ADMIN));

piecesRouter.route('/').get(getAllPieces).post(createPieces);

piecesRouter
  .route('/:id')
  .get(getOnePieces)
  .patch(updatePieces)
  .delete(deletePieces);

export default piecesRouter;
