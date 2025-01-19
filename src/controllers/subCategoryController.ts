import { NextFunction, Request, Response } from 'express';
import SubCategory from '@src/models/subCategoryModel';
import catchAsync from '@src/utils/catchAsync';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';

export const createSubCategory = createOne(SubCategory);
export const updateSubCategory = updateOne(SubCategory);
export const deleteSubCategory = deleteOne(SubCategory);
export const getOneSubCategory = getOne(SubCategory);
export const getAllSubCategory = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.query.category) {
      req.query.category = {
        $in: (req.query.category as string).split(','),
      };
    }

    await getAll(SubCategory)(req, res, next);
  }
);
