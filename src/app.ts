import path from 'path';
import cors from 'cors';
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
  PRODUCTION,
  RATE_LIMIT,
} from './constants/static';
import { TOO_MANY_REQUEST, routeNotFound } from './constants/messages';
import userRouter from './routes/userRoutes';
import AppError from './utils/appError';
import { StatusCode } from './types/customTypes';
import {
  ADDRESS_ROUTE,
  CATEGORY_ROUTE,
  COLLECTION_TIME_ROUTE,
  COLOUR_ROUTE,
  DELIVERY_METHOD_ROUTE,
  FLAVOUR_ROUTE,
  ORDER_ROUTE,
  PIECES_ROUTE,
  PRODUCT_ROUTE,
  SIZE_ROUTE,
  USER_ROUTE,
  WEBHOOK_CHECKOUT_ROUTE,
} from './constants/routeConstants';
import categoryRouter from './routes/categoryRoutes';
import globalErrorController from './controllers/globalErrorController';
import productRouter from './routes/productRoutes';
import sizeRouter from './routes/sizeRoutes';
import piecesRouter from './routes/piecesRoutes';
import flavourRouter from './routes/flavourRoutes';
import colourRouter from './routes/colourRoutes';
import addressRouter from './routes/addressRoutes';
import deliveryMethodRouter from './routes/deliveryMethodRoutes';
import orderRouter from './routes/orderRoutes';
import collectionTimeRouter from './routes/collectionTimeRoutes';
import { webhookCheckout } from './controllers/orderController';

const app = express();
const dirname = path.resolve();

// GLOBAL MIDDLEWARES

// Allow cors
app.use(cors());

// Parse incoming request bodies in JSON format
app.use(express.json());

// Set security http headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === DEVELOPMENT) {
  app.use(morgan('dev'));
}

// Limit requests from same API
if (process.env.NODE_ENV === PRODUCTION) {
  const limiter = rateLimit({
    max: RATE_LIMIT.max,
    windowMs: RATE_LIMIT.windowMs,
    message: TOO_MANY_REQUEST,
  });
  app.use('/api', limiter);
}

// Stripe webhook, BEFORE body-parser, because stripe needs the body as stream
app.post(
  WEBHOOK_CHECKOUT_ROUTE,
  express.raw({ type: 'application/json' }),
  webhookCheckout
);

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
app.use(PRODUCT_ROUTE, productRouter);
app.use(SIZE_ROUTE, sizeRouter);
app.use(PIECES_ROUTE, piecesRouter);
app.use(FLAVOUR_ROUTE, flavourRouter);
app.use(COLOUR_ROUTE, colourRouter);
app.use(ADDRESS_ROUTE, addressRouter);
app.use(DELIVERY_METHOD_ROUTE, deliveryMethodRouter);
app.use(COLLECTION_TIME_ROUTE, collectionTimeRouter);
app.use(ORDER_ROUTE, orderRouter);

// When no route found
app.all('*', (req: Request, _, next: NextFunction) => {
  next(new AppError(routeNotFound(req.originalUrl), StatusCode.NOT_FOUND));
});

app.use(globalErrorController);

export default app;
