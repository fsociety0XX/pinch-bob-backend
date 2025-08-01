import path from 'path';

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
export const NO_USER = 'Please login again.';
export const LOGIN_AGAIN =
  'User recently changed the password, Please login again.';
export const INVALID_TOKEN = 'Please provide a valid token.';
export const GOOGLE_REVIEWS_ERROR = 'Error in fetching google reviews';
export const UNAUTHORISED_ROLE = 'You are not authorised to access';
export const TOKEN_SENT = 'Token sent to email';
export const ASSIGN_ORDER_ERROR =
  'Please provide a valid woodelivery id and driver details';
export const EMAIL_FAILED =
  'Error in sending email, Please try again after sometime';
export const CURRENT_PASSWORD_INCORRECT = 'Your current password is incorrect.';
export const PRODUCT_SCHEMA_VALIDATION = {
  name: 'A product must have a name',
  slug: 'A product must have a slug',
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
  postalCode: 'A postal code is required',
  phone: 'A phone number is required',
  default: 'Problem in marking address as default',
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
  moneyPullingMax: 'Maximum number of notes allowed is 25',
  moneyPullingQty: 'Total number of notes should not be in decimals',
  orderNumber: 'Order number is required.',
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
export const PHONE_BRAND_REQ = 'Phone and brand are required';
export const PHONE_BRAND_OTP_REQ = 'Phone, brand & OTP are required';
export const INVALID_PHONE_OTP = 'Invalid OTP or phone number';
export const ORDER_NOT_FOUND = 'Order not found.';
export const ORDER_DELIVERY_DATE_ERR = `Delivery date should be greater than today's date`;
export const ORDER_FAIL_EMAIL = 'Order failure email sent successfully.';
export const DELIVERY_CREATE_ERROR = 'Error in creating delivery';
export const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');
export const PINCH_EMAILS = {
  welcomeEmail: {
    subject: 'Congrats! Welcome to Pinchbakehouse',
    template: 'welcomeEmail',
    previewText: 'Hey! So glad to see you',
  },
  forgotPassword: {
    subject: 'Reset password - valid for 10 minutes',
    template: 'forgotPassword',
    previewText: 'Reset password - valid for 10 minutes',
  },
  paymentLink: {
    subject: 'Thank you for your order',
    template: 'paymentLink',
    previewText: 'Pay Now - link valid for 24 hrs',
  },
  customiseCakeOrderConfirm: {
    subject: 'Thank you for your order',
    template: 'customiseCakeOrderConfirmation',
    previewText: 'Thank you for your order',
  },
  sendOtp: {
    subject: 'Your OTP for Pinchbakehouse',
    template: 'sendOtp',
    previewText: 'Your OTP for Pinchbakehouse',
  },
  orderConfirm: {
    subject: 'Thank you for your order',
    template: 'orderConfirmation',
    previewText: 'Thank you for your order',
  },
  orderFail: {
    subject: 'Payment failed for your recent order',
    template: 'orderFailure',
    previewText: 'Attention required',
  },
  orderPrepare: {
    subject: 'Your order is being prepared',
    template: 'orderPrepare',
    previewText: 'The wait is almost over',
  },
  reqForReview: {
    subject: 'Your order has been delivered!',
    template: 'orderDeliverAndReview',
    previewText: 'Your order has been delivered!',
  },
};
export const BOB_EMAILS = {
  welcomeEmail: {
    subject: 'Congrats! Welcome to Bob the Baker Boy',
    template: 'welcomeEmail',
    previewText: 'Hey! So glad to see you',
  },
  forgotPassword: {
    subject: 'Reset Your Bob the Baker Boy Password',
    template: 'forgotPassword',
    previewText: 'Reset password - valid for 10 minutes',
  },
  paymentLink: {
    subject: 'Thank you for your order - payment pending',
    template: 'paymentLink',
    previewText: 'Pay Now - link valid for 24 hrs',
  },
  customiseCakeOrderConfirm: {
    subject: 'Thank you for your order',
    template: 'customiseCakeOrderConfirmation',
    previewText: 'Your order is confirmed!',
  },
  sendOtp: {
    subject: 'Your OTP for Bob the Baker Boy',
    template: 'sendOtp',
    previewText: 'Your OTP for Bob the Baker Boy',
  },
  orderConfirm: {
    subject: 'Thank you for your order',
    template: 'orderConfirmation',
    previewText: 'Your order is confirmed!',
  },
  orderFail: {
    subject: 'Payment failed for your recent order',
    template: 'orderFailure',
    previewText: 'Attention required',
  },
  orderPrepare: {
    subject: 'Your order is being prepared',
    template: 'orderPrepare',
    previewText: 'The wait is almost over',
  },
};
export const COUPON_SCHEMA_VALIDATION = {
  code: 'Coupon name is required',
  type: 'A coupon must have a type',
  applicableOn: 'Please specify where this coupon can be applied',
  discountType:
    'Please specify the type of discount to be applied for this coupon',
  discount: 'A coupon must have discount value',
  invalid: 'Invalid or Expired Coupon',
  alreadyUsed: 'You have reached limit of using this coupon',
  notAvailable: 'This coupon is no longer available.',
  minPurchaseValue: 'Your cart value is low for this coupon',
  minQty: 'Your product quantity in cart is low for this coupon',
  notForYourCart: 'This coupon is not applicable on the products in your cart.',
};

export const SMS_SENT = 'SMS sent successfully';
export const EMAIL_SENT = 'Email sent successfully';

export const ORDER_PREP_EMAIL = {
  noOrdersFound: 'No orders found for the target date.',
  emailFailed: (orderNumber: string): string =>
    `Failed to send email for order ${orderNumber}:`,
  allTaskCompleted: 'All email sending tasks completed.',
  errorInSendingEmails: 'Error in sending order preparation emails:',
};

export const SUBCATEGORY_SCHEMA_VALIDATION = {
  category: 'A category is required.',
};

export const PRODUCT_NOT_FOUND = 'No product belongs to the given id';

export const DELIVERY_COLLECTION_TIME = {
  collectionTime: 'CollectionTime is required',
  timeFormat: "Invalid collectionTime format. Use '9am-1pm' format",
};

export const REF_IMG_UPDATE = {
  noImg: 'No images uploaded',
  noOrder: 'Order not found',
  noProduct: 'Product item not found',
  imgUploadSuccess: 'Images uploaded successfully',
};

export const BOB_SMS_CONTENT = {
  otp: (otp: string): string =>
    `<BobTheBakerBoy> Please use ${otp} for your login`,
  corporateDelivered:
    '<BobTheBakerBoy> All orders delivered. Contact 88623327 for assistance. Have a great day!',
  regularDelivered: (name: string): string =>
    `<BobTheBakerBoy> Hi ${name}, how was your experience ? Please share your feedback on Google: https://bit.ly/2VG9Md5. Get 10% off your next purchase with code WELCOMEBACK.`,
  paymentReminder: (link: string, orderNumber: string): string =>
    `<BobTheBakerBoy> Your celebration is coming, but your order #${orderNumber} is not confirmed yet! Finish payment here: ${link}. For help, WhatsApp 88623327.`,
};
