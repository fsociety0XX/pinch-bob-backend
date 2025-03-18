const VERSION1 = '/api/v1';
const WOODELIVERY_BASEURL = 'https://api.woodelivery.com/v2';

// MASTER ROUTES
export const USER_ROUTE = `${VERSION1}/user`;
export const AUTH_ROUTE = `${VERSION1}/auth`;
export const CATEGORY_ROUTE = `${VERSION1}/category`;
export const SUPER_CATEGORY_ROUTE = `${VERSION1}/superCategory`;
export const SUB_CATEGORY_ROUTE = `${VERSION1}/subCategory`;
export const PRODUCT_ROUTE = `${VERSION1}/product`;
export const SIZE_ROUTE = `${VERSION1}/size`;
export const PIECES_ROUTE = `${VERSION1}/pieces`;
export const FLAVOUR_ROUTE = `${VERSION1}/flavour`;
export const COLOUR_ROUTE = `${VERSION1}/colour`;
export const ADDRESS_ROUTE = `${VERSION1}/address`;
export const DELIVERY_METHOD_ROUTE = `${VERSION1}/deliveryMethod`;
export const ORDER_ROUTE = `${VERSION1}/order`;
export const DELIVERY_ROUTE = `${VERSION1}/delivery`;
export const COUPON_ROUTE = `${VERSION1}/coupon`;
export const CUSTOMISE_CAKE_ROUTE = `${VERSION1}/customiseCake`;
export const STRIPE_WEBHOOK_ROUTE = `${VERSION1}/stripe-webhook`;
export const HITPAY_WEBHOOK_ROUTE = `${VERSION1}/hitpay-webhook`;
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
export const ADD_TO_WISHLIST = `/addToWishlist/:id`;
export const ADD_TO_CART = `/addToCart/:id`;

// Checkout session
export const PLACE_ORDER = '/place-order';
export const GET_WOO_ID = '/woodeliveryId';
export const TRIGGER_ORDER_FAIL_EMAIL = '/order-failed/:orderId';

// DELIVERY
export const WOODELIVERY_TASK = `${WOODELIVERY_BASEURL}/tasks`;
export const GET_WOODELIVERY_DRIVERS = `${WOODELIVERY_BASEURL}/drivers`;
export const ASSIGN_TASK_TO_DRIVER = `${WOODELIVERY_BASEURL}/tasks/driver`;
export const GET_DRIVERS = '/drivers';
export const GET_DELIVERY_WITH_COLLECTION_TIME = '/collectionTime';
export const ASSIGN_ORDER_TO_DRIVER = '/assign/:id';
export const UNASSIGN_ORDER_TO_DRIVER = '/unassign/:id';
export const UPDATE_ORDER_STATUS = '/updateOrderStatus/:id';

// PRODUCT
export const FBT_ALSO_LIKE = '/fbtAlsoLike/:id';
// MIGRATION
export const MIGRATE = `/migrate`;

// GOOGLE
export const GA_URL = `https://www.google-analytics.com/mp/collect`;

// CUSTOMISE CAKE
export const UPDATE_FORM = '/form/:id';
export const SEND_PAYMENT_LINK = '/send/:id';
