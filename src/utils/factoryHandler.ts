/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable consistent-return */
import mongoose, { Model } from 'mongoose';
import { NextFunction, Request, Response } from 'express';
import { Role, StatusCode } from '@src/types/customTypes';
import catchAsync from './catchAsync';
import AppError from './appError';
import { NO_DATA_FOUND } from '@src/constants/messages';
import APIFeatures, { QueryString } from './apiFeatures';
import { IRequestWithUser } from '@src/controllers/authController';

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
    if (req.file) {
      req.body.image = req.file;
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
    if (req.files?.length) {
      req.body.images = req.files;
    }
    if (req.file) {
      req.body.image = req.file;
    }
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

export const softDeleteOne = (
  model: Model<any>
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const doc = await model.findByIdAndUpdate(
      req.params.id,
      { active: false },
      {
        new: true,
      }
    );
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
    });
  });

export const softDeleteMany = (
  model: Model<any>
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { ids } = req.body;
    const filter = {
      _id: {
        $in: ids?.map((id: string) => new mongoose.Types.ObjectId(id)),
      },
    };
    const update = { $set: { active: false } };

    const doc = await model.updateMany(filter, update);
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }
    res.status(StatusCode.SUCCESS).json({
      status: 'success',
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
  catchAsync(
    async (req: IRequestWithUser, res: Response, next: NextFunction) => {
      const currentPage = +req.query.page!;
      let isExtraParam = false; // Any param which is not related to pagination
      const pageParams = ['page', 'sort', 'limit', 'fields', 'active'];

      // If customer calls GET APIs then show only active records
      if (req.user?.role === Role.CUSTOMER) req.query.active = 'true';

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

      if (!allDocs) {
        return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
      }

      // Calculate total docs count
      Object.keys(req.query).forEach((params) => {
        if (!pageParams.includes(params)) {
          isExtraParam = true;
        }
      });

      let totalDocsCount = 0;

      if (isExtraParam) {
        delete req.query.limit;
        delete req.query.page;
        const featuresWithoutLimit = new APIFeatures(
          model.find(),
          req.query as QueryString
        )
          .filter(filterFields)
          .sort()
          .limit();
        totalDocsCount = await model
          .find(featuresWithoutLimit.query)
          .countDocuments();
      } else {
        const queryParams =
          req.user?.role === Role.CUSTOMER ? { active: true } : {};
        totalDocsCount = await model.find(queryParams).countDocuments();
      }

      res.status(StatusCode.SUCCESS).json({
        status: 'success',
        data: {
          data: allDocs,
        },
        meta: {
          totalDataCount: totalDocsCount,
          currentPage: +currentPage,
        },
      });
    }
  );
