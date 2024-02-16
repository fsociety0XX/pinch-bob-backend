/* eslint-disable import/prefer-default-export */
import { Model } from 'mongoose';
import { Request, Response } from 'express';
import { StatusCode } from '@src/types/customTypes';
import catchAsync from './catchAsync';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const createOne = (model: Model<any>) =>
  catchAsync(async (req: Request, res: Response) => {
    const doc = await model.create(req.body);
    res.status(StatusCode.CREATE).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });
