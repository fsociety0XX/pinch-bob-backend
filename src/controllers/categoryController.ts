/* eslint-disable import/prefer-default-export */
import Category from '@src/models/categoryModel';
import { createOne } from '@src/utils/factoryHandler';

export const createCategory = createOne(Category);
