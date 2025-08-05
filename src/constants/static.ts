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
];
