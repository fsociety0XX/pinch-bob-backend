import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import {
  BODY_PARSER_LIMIT,
  DEVELOPMENT,
  PREVENT_PARAMETER_POLLUTION,
  RATE_LIMIT,
} from './constants/static';
import { TOO_MANY_REQUEST, routeNotFound } from './constants/messages';
import userRouter from './routes/userRoutes';
import AppError from './utils/appError';
import { StatusCode } from './types/customTypes';
import { CATEGORY_ROUTE, USER_ROUTE } from './constants/routeConstants';
import categoryRouter from './routes/categoryRoutes';
import globalErrorController from './controllers/globalErrorController';

const app = express();
const dirname = path.resolve();

// GLOBAL MIDDLEWARES

// Set security http headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === DEVELOPMENT) {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: RATE_LIMIT.max,
  windowMs: RATE_LIMIT.windowMs,
  message: TOO_MANY_REQUEST,
});
app.use('/api', limiter);

// Body parser -> Reading data from body into req.body
app.use(express.json({ limit: BODY_PARSER_LIMIT }));

// Data sanitization against NoSql query injection
app.use(mongoSanitize());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: PREVENT_PARAMETER_POLLUTION,
  })
);

// Serving static files
app.use(express.static(`${dirname}/public`));

// Test middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 3) ROUTES
app.use(USER_ROUTE, userRouter);
app.use(CATEGORY_ROUTE, categoryRouter);
// When no route found
app.all('*', (req: Request, _, next: NextFunction) => {
  next(new AppError(routeNotFound(req.originalUrl), StatusCode.NOT_FOUND));
});

app.use(globalErrorController);

export default app;
