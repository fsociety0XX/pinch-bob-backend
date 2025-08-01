import { NextFunction, Request, Response } from 'express';
import Blog from '@src/models/blogModel';
import catchAsync from '@src/utils/catchAsync';
import {
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from '@src/utils/factoryHandler';
import { StatusCode } from '@src/types/customTypes';
import AppError from '@src/utils/appError';
import { NO_DATA_FOUND } from '@src/constants/messages';

export const updateBlog = updateOne(Blog);
export const deleteBlog = deleteOne(Blog);
export const getOneBlog = getOne(Blog);
export const getAllBlog = getAll(Blog);

export const createBlog = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.files?.length) {
      req.body.images = req.files;
    }
    if (req.body.category === '') {
      req.body.category = [];
    }
    const updatedPayload = { ...req.body };

    const doc = await Blog.create(updatedPayload);
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    res.status(StatusCode.CREATE).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  }
);

export const getOneBlogViaSlug = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const { brand } = req.body;

    const doc = await Blog.findOneAndUpdate(
      { slug, brand },
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  }
);
