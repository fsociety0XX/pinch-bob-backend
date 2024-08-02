import { NextFunction, Request, Response } from 'express';
import Product from '@src/models/productModel';
import catchAsync from '@src/utils/catchAsync';
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';
import AppError from '@src/utils/appError';
import { NO_DATA_FOUND } from '@src/constants/messages';
import { StatusCode } from '@src/types/customTypes';

export const createProduct = createOne(Product);
export const updateProduct = updateOne(Product);
export const getOneProduct = getOne(Product, {
  path: 'sizeDetails.size piecesDetails.pieces flavour colour category',
  select: 'name',
});
export const getAllProduct = getAll(Product, ['size', 'name']);
export const deleteProduct = deleteOne(Product);
export const getOneProductViaSlug = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const doc = await Product.findOne({ slug });
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
    return false;
  }
);
