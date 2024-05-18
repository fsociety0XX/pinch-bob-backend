const VERSION1 = '/api/v1';
const WOODELIVERY_BASEURL = 'https://api.woodelivery.com/api/form';

// MASTER ROUTES
export const USER_ROUTE = `${VERSION1}/user`;
export const AUTH_ROUTE = `${VERSION1}/auth`;
export const CATEGORY_ROUTE = `${VERSION1}/category`;
export const SUPER_CATEGORY_ROUTE = `${VERSION1}/superCategory`;
export const PRODUCT_ROUTE = `${VERSION1}/product`;
export const SIZE_ROUTE = `${VERSION1}/size`;
export const PIECES_ROUTE = `${VERSION1}/pieces`;
export const FLAVOUR_ROUTE = `${VERSION1}/flavour`;
export const COLOUR_ROUTE = `${VERSION1}/colour`;
export const ADDRESS_ROUTE = `${VERSION1}/address`;
export const DELIVERY_METHOD_ROUTE = `${VERSION1}/deliveryMethod`;
export const ORDER_ROUTE = `${VERSION1}/order`;
export const DELIVERY_ROUTE = `${VERSION1}/delivery`;
export const WEBHOOK_CHECKOUT_ROUTE = `${VERSION1}/webhook-checkout`;
export const SEARCH = `${VERSION1}/search`;

// AUTH
export const SIGN_UP = `/signup`;
export const SIGN_IN = `/signin`;
export const SEND_OTP = `/send-otp`;
export const VERIFY_OTP = `/verify-otp`;
export const FORGOT_PASSWORD = `/forgot-password`;
export const RESET_PASSWORD = `/reset-password/:token`;

// USERS
export const CHANGE_PASSWORD = `/change-password`;

// Checkout session
export const PLACE_ORDER = '/place-order';
export const TRIGGER_ORDER_FAIL_EMAIL = '/order-failed/:orderId';

// DELIVERY
export const CREATE_WOODELIVERY_TASK = `${WOODELIVERY_BASEURL}/createtask`;
export const GET_WOODELIVERY_DRIVERS = `${WOODELIVERY_BASEURL}/getdrivers`;
export const ASSIGN_TASK_TO_DRIVER = `${WOODELIVERY_BASEURL}/assigntasktodriver`;
export const GET_DRIVERS = '/drivers';
export const ASSIGN_ORDER_TO_DRIVER = '/assign/:id';
export const UPDATE_ORDER_STATUS = '/updateOrderStatus/:id';
