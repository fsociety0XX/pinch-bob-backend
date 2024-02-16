const VERSION1 = '/api/v1';

// MASTER ROUTES
export const USER_ROUTE = `${VERSION1}/users`;
export const CATEGORY_ROUTE = `${VERSION1}/category`;

// AUTH
export const SIGN_UP = `/signup`;
export const SIGN_IN = `/signin`;
export const FORGOT_PASSWORD = `/forgot-password`;
export const RESET_PASSWORD = `/reset-password/:token`;

// USERS
export const CHANGE_PASSWORD = `/change-password`;