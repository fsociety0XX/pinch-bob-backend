export enum StatusCode {
  SUCCESS = 200,
  CREATE = 201,
  NOT_FOUND = 404,
  BAD_REQUEST = 400,
  UNAUTHORISED = 401,
  INTERNAL_SERVER_ERROR = 500,
  NO_CONTENT = 204,
}

export enum Role {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  STAFF = 'staff',
}
export interface errorObject {
  message?: string;
}

export const brandEnum = ['pinch', 'bob'];
export const typeEnum = ['cake', 'bake'];
