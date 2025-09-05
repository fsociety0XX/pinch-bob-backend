export const PREVENT_PARAMETER_POLLUTION = [
  'duration',
  'ratingsAverage',
  'ratingsQuantity',
  'maxGroupSize',
  'price',
  'difficulty',
];
export const DEVELOPMENT = 'development';
export const PRODUCTION = 'production';
export const RATE_LIMIT = {
  max: 100,
  windowMs: 60 * 60 * 1000,
};

// Enhanced rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  // Public endpoints - standard limits
  PUBLIC: {
    max: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Admin endpoints - more lenient limits
  ADMIN: {
    max: 500,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Authentication endpoints - strict limits
  AUTH: {
    max: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Order endpoints - moderate limits (for checkout processes)
  ORDER: {
    max: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
};

// Rate limiting route groups for easier management
export const RATE_LIMIT_ROUTES = {
  // Authentication routes requiring strict limits
  AUTH_ROUTES: ['/signin', '/signup', '/forgot-password', '/reset-password'],
  // Admin routes requiring lenient limits
  ADMIN_ROUTES: ['report', 'user', 'delivery'],
  // Public catalog routes requiring standard limits
  PUBLIC_ROUTES: [
    'product',
    'category',
    'blog',
    'superCategory',
    'subCategory',
    'size',
    'pieces',
    'flavour',
    'colour',
    'coupon',
  ],
  // Order routes requiring moderate limits
  ORDER_ROUTES: ['order'],
};
export const BODY_PARSER_LIMIT = '10kb';
export const IMAGE_SIZE_LIMIT = 1024 * 1024 * 10; // 10mb file size
export const WOODELIVERY_STATUS: { [key: number]: string } = {
  10: 'Unassigned',
  15: 'Assigning',
  20: 'Assigned',
  25: 'Processed',
  28: 'Loaded',
  30: 'Transit',
  40: 'Arrived',
  45: 'Awaiting Collection',
  50: 'Completed',
  51: 'Failed',
  52: 'Returned',
  90: 'Cancelled',
};
export const SELF_COLLECT_ADDRESS =
  '218 Pandan Loop, Level 1 Reception Xpace, 128408';

export const BOB_EMAIL_DETAILS = {
  faqLink: 'https://bobthebakerboy.com/faq',
  whatsappLink: 'https://wa.me/6588623327',
  homeUrl: 'https://bobthebakerboy.com',
  welcomeCouponCode: 'HELLOFFD',
  orderNow: 'https://bobthebakerboy.com/order',
  loginLink: 'https://bobthebakerboy.com/login',
};

export const BLACK_LISTED_EMAILS = [
  'angela.chia@bigtinygroup.com',
  'onegoodday.mattlam@gmail.com',
  'kentay.propnex@gmail.com',
];
