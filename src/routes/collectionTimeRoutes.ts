import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { Role } from '@src/types/customTypes';
import {
  createCollectionTime,
  deleteCollectionTime,
  getAllCollectionTime,
  getOneCollectionTime,
  updateCollectionTime,
} from '@src/controllers/collectionTimeController';

const collectionTimeRoutes = express.Router();

collectionTimeRoutes.route('/').get(getAllCollectionTime); // No protection for get all data

collectionTimeRoutes.use(protect, roleRistriction(Role.ADMIN));
collectionTimeRoutes.route('/').post(createCollectionTime);

collectionTimeRoutes
  .route('/:id')
  .get(getOneCollectionTime)
  .patch(updateCollectionTime)
  .delete(deleteCollectionTime);

export default collectionTimeRoutes;
