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
