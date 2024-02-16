import { StatusCode } from '@src/types/customTypes';

class AppError extends Error {
  statusCode?: number;

  errorMessage?: string;

  status?: string;

  isOperational?: boolean;

  constructor(message: string, statusCode: StatusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errorMessage = message;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
