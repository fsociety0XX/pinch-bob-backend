/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable consistent-return */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import mongoose, { Model } from 'mongoose';
import { NextFunction, Request, Response } from 'express';
import { CANCELLED, Role, StatusCode } from '@src/types/customTypes';
import catchAsync from './catchAsync';
import AppError from './appError';
import { NO_DATA_FOUND } from '@src/constants/messages';
import APIFeatures, { QueryString } from './apiFeatures';
import { IRequestWithUser } from '@src/controllers/authController';
import logActivity, { ActivityActions } from './activityLogger';

interface IPopulateOptions {
  path: string;
  select?: string;
}
interface AuditOptions {
  action: keyof typeof ActivityActions;
  module: string;
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
  model: Model<any>,
  audit?: AuditOptions
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (req.files?.length) {
      req.body.images = req.files;
    }
    if (req.file) {
      req.body.image = req.file;
    }

    const before = audit ? await model.findById(req.params.id) : null;

    const doc = await model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    // Log only if audit config is passed
    if (audit && req.user) {
      await logActivity({
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
        action: ActivityActions[audit.action],
        module: audit.module,
        targetId: doc._id.toString(),
        metadata: {
          before,
          after: doc,
        },
        brand: req.brand,
      });
    }

    res.status(StatusCode.SUCCESS).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

export const softDeleteOne = (
  model: Model<any>,
  audit?: { action: keyof typeof ActivityActions; module: string }
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const before = audit ? await model.findById(req.params.id) : null;

    const doc = await model.findByIdAndUpdate(
      req.params.id,
      { active: false, status: CANCELLED },
      { new: true }
    );

    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    if (audit && req.user) {
      await logActivity({
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
        action: ActivityActions[audit.action],
        module: audit.module,
        targetId: doc._id.toString(),
        metadata: { before, after: doc },
        brand: req.brand,
      });
    }

    res.status(StatusCode.SUCCESS).json({ status: 'success' });
  });

export const softDeleteMany = (
  model: Model<any>,
  audit?: { action: keyof typeof ActivityActions; module: string }
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { ids } = req.body;
    const filter = {
      _id: { $in: ids?.map((id: string) => new mongoose.Types.ObjectId(id)) },
    };
    const update = { $set: { active: false, status: CANCELLED } };

    const doc = await model.updateMany(filter, update);
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    if (audit && req.user) {
      await logActivity({
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
        action: ActivityActions[audit.action],
        module: audit.module,
        targetId: ids.join(','),
        metadata: { ids },
        brand: req.brand,
      });
    }

    res.status(StatusCode.SUCCESS).json({ status: 'success' });
  });

export const deleteOne = (
  model: Model<any>,
  audit?: { action: keyof typeof ActivityActions; module: string }
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const before = audit ? await model.findById(req.params.id) : null;

    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) {
      return next(new AppError(NO_DATA_FOUND, StatusCode.NOT_FOUND));
    }

    if (audit && req.user) {
      await logActivity({
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
        action: ActivityActions[audit.action],
        module: audit.module,
        targetId: doc._id.toString(),
        metadata: { before },
        brand: req.brand,
      });
    }

    res.status(StatusCode.NO_CONTENT).json({ status: 'success' });
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
 * @returns
 */
export const getAll = (
  model: Model<any>
): ((req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  catchAsync(
    async (req: IRequestWithUser, res: Response, next: NextFunction) => {
      const currentPage = +req.query.page!;
      let isExtraParam = false; // Any param which is not related to pagination
      const pageParams = ['page', 'sort', 'limit', 'fields', 'active'];

      // If customer calls GET APIs then show only active records
      if (req.user?.role === Role.CUSTOMER) req.query.active = 'true';

      // Special case for handling search query for name with single/multiple values
      if (req.query.name && typeof req.query.name === 'string') {
        const names = req.query.name.split(',').map((n) => n.trim());
        const exact = req.query.exact === 'true';

        if (exact) {
          // Exact match: $or with direct equality
          req.query.$or = names.map((name) => ({
            name,
          }));
        } else {
          // Loose match: case-insensitive, punctuation-removed, regex
          req.query.$or = names.map((name) => ({
            $expr: {
              $regexMatch: {
                input: {
                  $toLower: {
                    $replaceAll: {
                      input: {
                        $replaceAll: {
                          input: {
                            $replaceAll: {
                              input: '$name',
                              find: '(',
                              replacement: '',
                            },
                          },
                          find: ')',
                          replacement: '',
                        },
                      },
                      find: "'",
                      replacement: '',
                    },
                  },
                },
                regex: name.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase(),
                options: 'i',
              },
            },
          }));
        }

        // Clean up
        delete req.query.name;
        delete req.query.exact;
      }

      const features = new APIFeatures(model.find(), req.query as QueryString)
        .filter()
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
          .filter()
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
