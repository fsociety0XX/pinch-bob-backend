const VERSION1 = '/api/v1';

// MASTER ROUTES
export const USER_ROUTE = `${VERSION1}/users`;
export const CATEGORY_ROUTE = `${VERSION1}/category`;
export const PRODUCT_ROUTE = `${VERSION1}/product`;
export const SIZE_ROUTE = `${VERSION1}/size`;
export const PIECES_ROUTE = `${VERSION1}/pieces`;
export const FLAVOUR_ROUTE = `${VERSION1}/flavour`;
export const COLOUR_ROUTE = `${VERSION1}/colour`;
export const ADDRESS_ROUTE = `${VERSION1}/address`;
export const DELIVERY_METHOD_ROUTE = `${VERSION1}/deliveryMethod`;
export const COLLECTION_TIME_ROUTE = `${VERSION1}/collectionTime`;
export const ORDER_ROUTE = `${VERSION1}/order`;
export const WEBHOOK_CHECKOUT_ROUTE = `${VERSION1}/webhook-checkout`;

// AUTH
export const SIGN_UP = `/signup`;
export const SIGN_IN = `/signin`;
export const FORGOT_PASSWORD = `/forgot-password`;
export const RESET_PASSWORD = `/reset-password/:token`;

// USERS
export const CHANGE_PASSWORD = `/change-password`;

// Checkout session
export const PLACE_ORDER = '/place-order';
export const TRIGGER_ORDER_FAIL_EMAIL = '/order-failed/:orderId';
