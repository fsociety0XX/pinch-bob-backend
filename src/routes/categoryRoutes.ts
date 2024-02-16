import express from 'express';
import { protect, roleRistriction } from '@src/controllers/authController';
import { createCategory } from '@src/controllers/categoryController';
import { Role } from '@src/types/customTypes';

const categoryRouter = express.Router();

categoryRouter.post('/', protect, roleRistriction(Role.ADMIN), createCategory);

export default categoryRouter;
