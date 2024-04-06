/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable consistent-return */
import { Model } from 'mongoose';
import { NextFunction, Request, Response } from 'express';
import { StatusCode } from '@src/types/customTypes';
import catchAsync from './catchAsync';
import AppError from './appError';
import { NO_DATA_FOUND } from '@src/constants/messages';
import APIFeatures, { QueryString } from './apiFeatures';

interface IPopulateOptions {
  path: string;
  select?: string;
}

export const createOne = (
  model: Model<any>
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response) => {
    if (req.files?.length) {
      req.body.images = req.files;
    }
    const doc = await model.create(req.body);
    res.status(StatusCode.CREATE).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

export const updateOne = (
  model: Model<any>
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const doc = await model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

export const deleteOne = (
  model: Model<any>
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.NO_CONTENT).json({
      status: 'success',
    });
  });

export const getOne = (
  model: Model<any>,
  populateOptions?: IPopulateOptions
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const query = model.findById(req.params.id);
    if (populateOptions) query.populate(populateOptions);
    const doc = await query.exec();
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

/**
 *
 * @param model
 * @param filterFields - when you have a query param which can have multiple value in comma separated form
 * then pass that particular query param name in filterFields. This uses 'split' method and convert the
 * multiple comma separated string into array.
 * example: /api/v1/order?user=123,456,789
 * pass user through filterFields and it will convert user = [123,456,789] and put it inside query object.
 * So that mongodb can execute this query properly.
 * NOTE - Only use if a query can have multiple comma separated string values
 * @returns
 */
export const getAll = (
  model: Model<any>,
  filterFields = ['']
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    let totalDocsCount = 0;
    const currentPage = +req.query.page!;
    let isExtraParam = false; // Any param which is not related to pagination
    const pageParams = ['page', 'sort', 'limit', 'fields', 'active'];

    // Special case for category where we need to apply '$in' mongodb query
    if (req.query.category) {
      req.query.category = {
        in: (req.query.category as string).split(','),
      };
    }
    const features = new APIFeatures(model.find(), req.query as QueryString)
      .filter(filterFields)
      .sort()
      .limit()
      .pagination();
    const allDocs = await features.query.exec();

    // Calculate total docs count
    Object.keys(req.query).forEach((params) => {
      if (!pageParams.includes(params)) {
        isExtraParam = true;
      }
    });

    if (isExtraParam) {
      delete req.query.limit;
      delete req.query.page;
      const featuresWithoutLimit = new APIFeatures(
        model.find({ active: true }),
        req.query as QueryString
      )
        .filter(filterFields)
        .sort()
        .limit()
        .pagination();
      totalDocsCount = await model
        .find(featuresWithoutLimit.query)
        .countDocuments();
    } else {
      totalDocsCount = await model.find({ active: true }).countDocuments();
    }

    if (!allDocs) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: allDocs,
      },
      meta: {
        totalDataCount: totalDocsCount,
        currentPage: +currentPage || 1,
      },
    });
  });
