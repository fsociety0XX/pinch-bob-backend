import { NextFunction, Request, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/ban-types
const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return fn(req, res, next).catch(next);
  };
};

export default catchAsync;
