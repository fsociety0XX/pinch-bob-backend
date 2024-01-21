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
export const brandEnum = ['pinch', 'bob'];
export const roleEnum = ['admin', 'customer', 'staff'];
export const routeNotFound = (url: string): string =>
  `Can't find ${url} on this server!`;
export const imageFileTypeValidation = 'Please upload valid image file';
