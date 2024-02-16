export const TOO_MANY_REQUEST =
  'Too many requests from this IP, Please try after sometime';
export const DB_CONNECT_SUCCESS = 'DB connection successful';
export const USER_SCHEMA_VALIDATION = {
  firstName: 'A first name is required',
  lastName: 'A first name is required',
  email: 'A email is required',
  phone: 'A phone number is required',
  invalidEmail: 'Invalid email id',
  brand: 'A brand is required',
  password: 'A password is required',
  mismatchPasswords: 'Password and Confirm password did not match.',
  confirmPassword: 'Please confirm your password',
};
export const routeNotFound = (url: string): string =>
  `Can't find ${url} on this server!`;
export const IMAGE_FILE_TYPE_VALIDATION = 'Please upload valid image file';
export const INVALID_CREDENTIALS = 'Please provide valid email and password';
export const UNAUTHORISED = 'Please login again.';
export const TOKEN_INVALID = 'Token invalid, Please login again.';
export const TOKEN_EXPIRED = 'Token expired, Please login again.';
export const NO_USER = 'User does not exist';
export const LOGIN_AGAIN =
  'User recently changed the password, Please login again.';
export const INVALID_TOKEN = 'Please provide a valid token.';
export const UNAUTHORISED_ROLE = 'You are not authorised to access';
export const TOKEN_SENT = 'Token sent to email';
export const EMAIL_FAILED =
  'Error in sending email, Please try again after sometime';
export const CURRENT_PASSWORD_INCORRECT = 'Your current password is incorrect.';
export const PRODUCT_SCHEMA_VALIDATION = {
  name: 'A product must have a name',
  price: 'A product must have a price',
  currency: 'A currency is required',
  brand: 'A product must have a brand',
  images: 'Product images are required',
  type: 'A product must have a type',
  detail: 'A product detail is required',
  category: 'A category is required.',
};
export const CATEGORY_SCHEMA_VALIDATION = {
  brand: 'A brand is required',
  name: 'A name is required',
};
export const GENERIC_ERROR = 'Something went wrong!';
