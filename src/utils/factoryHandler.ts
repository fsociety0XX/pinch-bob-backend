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

export const getAll = (
  model: Model<any>,
  selectFields = '',
  filterFields = ['']
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    let totalDocsCount = 0;
    let isExtraParam = false; // Any param which is not related to pageination
    const pageParams = ['page', 'sort', 'limit', 'fields', 'active'];

    // let filter = {};
    // if (req.params.id) filter = { product: req.params.id };
    const features = new APIFeatures(
      model.find().select(selectFields),
      req.query as QueryString
    )
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
      totalDocsCount = await model.find(features.query).countDocuments();
    } else {
      totalDocsCount = await model.countDocuments();
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
        currentPage: req.query.page || 1,
      },
    });
  });
