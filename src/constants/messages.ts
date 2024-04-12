export const TOO_MANY_REQUEST =
  'Too many requests from this IP, Please try after sometime';
export const DB_CONNECT_SUCCESS = 'DB connection successful';
export const USER_SCHEMA_VALIDATION = {
  firstName: 'A first name is required',
  lastName: 'A last name is required',
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
export const REGISTER_ERROR =
  'You were not registered, Please provide correct details';
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
  atleastOneImage: 'Atleast one image is required',
  type: 'A product must have a type',
  detail: 'A product detail is required',
  category: 'A category is required.',
  superCategory: 'A super category is required.',
  minRatingsAvg: 'Rating must be greater than 1',
  maxRatingsAvg: 'Rating must be less than 5',
  preparationDays: 'A product must have preparation days mentioned',
};
export const COMMON_SCHEMA_VALIDATION = {
  brand: 'A brand is required',
  name: 'A name is required',
};
export const GENERIC_ERROR = 'Something went wrong!';
export const NO_DATA_FOUND = 'No data found with that ID';
export const ADDRESS_SCHEMA_VALIDATION = {
  firstName: 'A first name is required',
  lastName: 'A last name is required',
  city: 'A city is required',
  country: 'A country is required',
  address1: 'A address1 is required',
  address2: 'A address2 is required',
  postalCode: 'A postal code is required',
  phone: 'A phone number is required',
  default: 'Problem is marking address as default',
};
export const ADDRESS_AUTH_ERR =
  'You are not authorised to make any changes to this address';
export const DELIVERY_METHOD_VALIDATION = {
  price: 'A delivery method must have a price',
  info: 'A delivery method must have a description',
};
export const COLLECTION_TIME_VALIDATION = {
  startTime: 'A collection time must have start time',
  endTime: 'A collection time must have end time',
};
export const ORDER_SCHEMA_VALIDATION = {
  product: 'An order must have a product details',
  delivery: 'Delivery details are for the order',
  pricingSummary: 'Pricing details in order summary is required',
  paid: 'A payment confirmation status is required for an order',
};
export const ORDER_AUTH_ERR =
  'You are not authorised to make any changes to this order';
export const OTP_SENT = 'OTP sent successfully';
export const OTP_VERIFIED = 'OTP verified successfully';
export const OTP_EXPIRED = 'OTP has expired';
export const INVALID_OTP = 'OTP is invalid';
export const ORDER_NOT_FOUND = 'Order not found.';
