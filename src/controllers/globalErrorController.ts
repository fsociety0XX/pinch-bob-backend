/* eslint-disable no-param-reassign */
import { Error as MongooseError } from 'mongoose';
import { NextFunction, Request, Response } from 'express';
import { StatusCode } from '@src/types/customTypes';
import AppError from '@src/utils/appError';
import {
  GENERIC_ERROR,
  TOKEN_EXPIRED,
  TOKEN_INVALID,
} from '@src/constants/messages';
import { DEVELOPMENT, PRODUCTION } from '@src/constants/static';

interface MongooseDuplicateError extends MongooseError {
  keyValue?: {
    [key: string]: string;
  };
}

interface MongooseValidationError extends MongooseError {
  errors?: Record<string, { message: string }>;
}

interface MongooseEnvironmentError extends MongooseError {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  code?: number;
  path?: string;
  value?: string;
  errorMessage?: string;
}

const handleCastErrorDB = (err: MongooseEnvironmentError): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, StatusCode.BAD_REQUEST);
};

const handleDuplicateErrorDB = (err: MongooseDuplicateError): AppError => {
  const duplicateData = err?.keyValue || {};
  const fieldName = Object.keys(duplicateData);
  const value = Object.values(duplicateData)[0];
  const message = `Duplicate value: ${value} found for ${fieldName}. Please try another value`;
  return new AppError(message, StatusCode.BAD_REQUEST);
};

const handleValidationErrorDB = (err: MongooseValidationError): AppError => {
  const errors = Object.values(err?.errors ?? {})?.map((d) => d.message);
  const message = `Invalid input data. ${errors.join(', ')}`;
  return new AppError(message, StatusCode.BAD_REQUEST);
};

const handleJwtError = (): AppError =>
  new AppError(TOKEN_INVALID, StatusCode.UNAUTHORISED);

const handleJwtExpireError = (): AppError =>
  new AppError(TOKEN_EXPIRED, StatusCode.UNAUTHORISED);

const errorInDev = (err: MongooseEnvironmentError, res: Response) => {
  res.status(err.statusCode!).json({
    status: err.status,
    error: err,
    message: err.errorMessage,
    stack: err.stack,
  });
};

const errorInProd = (err: MongooseEnvironmentError, res: Response) => {
  // Operational error: trusted error so send message to client
  if (err?.isOperational) {
    res.status(err.statusCode!).json({
      status: err.status,
      message: err.errorMessage,
    });
  } else {
    // Programming or other error: don't leak error details to client
    // 1. Log error
    console.error('Error 💥', err);
    // 2. Send response
    res.status(StatusCode.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: GENERIC_ERROR,
    });
  }
};

export default (
  err: MongooseEnvironmentError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  console.log(err);
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  if (process.env.NODE_ENV === DEVELOPMENT) {
    errorInDev(err, res);
  } else if (process.env.NODE_ENV === PRODUCTION) {
    let error = { ...err };
    if (err.name === 'CastError') error = handleCastErrorDB(error); // 'name' is a prototype property so even after destructuring {...err} 'name' property won't be accessible in error variable.
    if (err.code === 11000) error = handleDuplicateErrorDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (err.name === 'JsonWebTokenError') error = handleJwtError();
    if (err.name === 'TokenExpiredError') error = handleJwtExpireError();

    errorInProd(error, res);
  }
};
