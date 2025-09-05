/* eslint-disable import/no-duplicates */
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
  RATE_LIMIT_CONFIG,
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
  HITPAY_WEBHOOK_ROUTE,
  ORDER_ROUTE,
  PIECES_ROUTE,
  PRODUCT_ROUTE,
  SEARCH,
  SIZE_ROUTE,
  SUPER_CATEGORY_ROUTE,
  USER_ROUTE,
  STRIPE_WEBHOOK_ROUTE,
  SUB_CATEGORY_ROUTE,
  REPORT_ROUTE,
  BLOG_ROUTE,
  SIGN_IN,
  SIGN_UP,
  FORGOT_PASSWORD,
  RESET_PASSWORD,
  SEND_OTP,
  SEND_PHONE_OTP,
  VERIFY_OTP,
  VERIFY_PHONE_OTP,
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
import {
  hitpayWebhookHandler,
  stripeWebhookHandler,
} from './controllers/orderController';
import deliveryRouter from './routes/deliveryRoutes';
import superCategoryRouter from './routes/superCategoryRoutes';
import authRouter from './routes/authRoutes';
import userRouter from './routes/userRoutes';
import { protect, roleRistriction } from './controllers/authController';
import { globalTableSearch } from './controllers/globalSearchController';
import couponRouter from './routes/couponRoutes';
import customiseCakeRouter from './routes/customiseCakeRoutes';
import '@src/controllers/orderController';
import '@src/crons/orderCron';
import '@src/crons/mailchimpCron';
import '@src/crons/reviewsCron';
import subCategoryRouter from './routes/subCategoryRoutes';
import reportRouter from './routes/reportRoutes';
import blogRouter from './routes/blogRoutes';

const app = express();
const dirname = path.resolve();

// GLOBAL MIDDLEWARES

// Allow cors
app.use(cors());

// Stripe webhook, BEFORE body-parser, because stripe needs the body as stream
app.post(
  STRIPE_WEBHOOK_ROUTE,
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);
// Hitpay webhook, BEFORE body-parser, because hitpay needs the body in raw format
app.post(
  HITPAY_WEBHOOK_ROUTE,
  express.raw({ type: 'application/json' }),
  hitpayWebhookHandler
);

// Parse incoming request bodies in JSON format
app.use(express.json({ limit: '100mb' }));

// Set security http headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === DEVELOPMENT) {
  app.use(morgan('dev'));
}

// Smart Rate Limiting - Only for authentication endpoints
if (process.env.NODE_ENV === PRODUCTION) {
  // Note: Only authentication routes have rate limiting for security
  // All other routes have unlimited access

  // Strict rate limiter for authentication endpoints
  const authLimiter = rateLimit({
    max: RATE_LIMIT_CONFIG.AUTH.max,
    windowMs: RATE_LIMIT_CONFIG.AUTH.windowMs,
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiters to specific routes based on sensitivity
  // Authentication routes - strictest limits (20 per hour) - SECURITY CRITICAL
  app.use(AUTH_ROUTE + SIGN_IN, authLimiter);
  app.use(AUTH_ROUTE + SIGN_UP, authLimiter);
  app.use(AUTH_ROUTE + FORGOT_PASSWORD, authLimiter);
  app.use(AUTH_ROUTE + RESET_PASSWORD.replace('/:token', ''), authLimiter); // Remove param for middleware

  // Twilio SMS/OTP routes - SECURITY CRITICAL (prevent SMS abuse and OTP spam)
  app.use(AUTH_ROUTE + SEND_OTP, authLimiter);
  app.use(AUTH_ROUTE + SEND_PHONE_OTP, authLimiter);
  app.use(AUTH_ROUTE + VERIFY_OTP, authLimiter);
  app.use(AUTH_ROUTE + VERIFY_PHONE_OTP, authLimiter);
}

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
app.use(BLOG_ROUTE, blogRouter);
app.use(SUPER_CATEGORY_ROUTE, superCategoryRouter);
app.use(SUB_CATEGORY_ROUTE, subCategoryRouter);
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
app.use(REPORT_ROUTE, reportRouter);
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
