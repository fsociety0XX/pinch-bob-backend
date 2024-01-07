declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    PORT: string;
    DB: string;
    JWT_SCERET: string;
    JWT_EXPIRES_IN: string;
    JWT_COOKIE_EXPIRES_IN: string;
  }
}

declare namespace Express {
  export interface Request {
    requestTime?: string;
  }
}
