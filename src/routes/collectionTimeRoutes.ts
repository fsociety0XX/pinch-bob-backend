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

const collectionTimeRouter = express.Router();

collectionTimeRouter.route('/').get(getAllCollectionTime); // No protection for get all data

collectionTimeRouter.use(protect, roleRistriction(Role.ADMIN));
collectionTimeRouter.route('/').post(createCollectionTime);

collectionTimeRouter
  .route('/:id')
  .get(getOneCollectionTime)
  .patch(updateCollectionTime)
  .delete(deleteCollectionTime);

export default collectionTimeRouter;
