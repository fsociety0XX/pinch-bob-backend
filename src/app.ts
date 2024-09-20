import path from 'path';
import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
// import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import {
  BODY_PARSER_LIMIT,
  DEVELOPMENT,
  PREVENT_PARAMETER_POLLUTION,
  // PRODUCTION,
  // RATE_LIMIT,
} from './constants/static';
import { routeNotFound } from './constants/messages';
import AppError from './utils/appError';
import { Role, StatusCode } from './types/customTypes';
import {
  ADDRESS_ROUTE,
  AUTH_ROUTE,
  CATEGORY_ROUTE,
  COLOUR_ROUTE,
  COUPON_ROUTE,
  CUSTOMISE_CAKE_ROUTE,
  DELIVERY_METHOD_ROUTE,
  DELIVERY_ROUTE,
  FLAVOUR_ROUTE,
  ORDER_ROUTE,
  PIECES_ROUTE,
  PRODUCT_ROUTE,
  SEARCH,
  SIZE_ROUTE,
  SUPER_CATEGORY_ROUTE,
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
import { webhookCheckout } from './controllers/orderController';
import deliveryRouter from './routes/deliveryRoutes';
import superCategoryRouter from './routes/superCategoryRoutes';
import authRouter from './routes/authRoutes';
import userRouter from './routes/userRoutes';
import { protect, roleRistriction } from './controllers/authController';
import { globalTableSearch } from './controllers/globalSearchController';
import couponRouter from './routes/couponRoutes';
import customiseCakeRouter from './routes/customiseCakeRoutes';

const app = express();
const dirname = path.resolve();

// GLOBAL MIDDLEWARES

// Allow cors
app.use(cors());

// Stripe webhook, BEFORE body-parser, because stripe needs the body as stream
app.post(
  WEBHOOK_CHECKOUT_ROUTE,
  express.raw({ type: 'application/json' }),
  webhookCheckout
);

// Parse incoming request bodies in JSON format
app.use(express.json());

// Set security http headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === DEVELOPMENT) {
  app.use(morgan('dev'));
}

// Limit requests from same API
// if (process.env.NODE_ENV === PRODUCTION) {
//   const limiter = rateLimit({
//     max: RATE_LIMIT.max,
//     windowMs: RATE_LIMIT.windowMs,
//     message: TOO_MANY_REQUEST,
//   });
//   app.use('/api', limiter);
// }

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

// Brand middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.body.brand) {
    req.body.brand = req.headers.brand || req.headers.Brand;
  }
  req.requestTime = new Date().toISOString();
  next();
});

// 3) ROUTES
app.use(AUTH_ROUTE, authRouter);
app.use(USER_ROUTE, userRouter);
app.use(CATEGORY_ROUTE, categoryRouter);
app.use(SUPER_CATEGORY_ROUTE, superCategoryRouter);
app.use(PRODUCT_ROUTE, productRouter);
app.use(SIZE_ROUTE, sizeRouter);
app.use(PIECES_ROUTE, piecesRouter);
app.use(FLAVOUR_ROUTE, flavourRouter);
app.use(COLOUR_ROUTE, colourRouter);
app.use(ADDRESS_ROUTE, addressRouter);
app.use(DELIVERY_METHOD_ROUTE, deliveryMethodRouter);
app.use(ORDER_ROUTE, orderRouter);
app.use(DELIVERY_ROUTE, deliveryRouter);
app.use(COUPON_ROUTE, couponRouter);
app.use(CUSTOMISE_CAKE_ROUTE, customiseCakeRouter);
app
  .use(protect, roleRistriction(Role.ADMIN))
  .route(SEARCH)
  .get(globalTableSearch); // Global middleware for searcing data inside tabels

// When no route found
app.all('*', (req: Request, _, next: NextFunction) => {
  next(new AppError(routeNotFound(req.originalUrl), StatusCode.NOT_FOUND));
});

app.use(globalErrorController);

export default app;
