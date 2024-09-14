import 'module-alias/register';
import dotenv from 'dotenv-safe';
import mongoose from 'mongoose';
import app from './app';
import { errorObject } from './types/customTypes';
import { DB_CONNECT_SUCCESS } from './constants/messages';

process.on('uncaughtException', (err) => {
  console.log(err?.message);
  process.exit(1);
});

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

mongoose
  .connect(process.env.DB)
  .then(() => console.log(DB_CONNECT_SUCCESS))
  .catch((err) => console.error(err));

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

process.on('unhandledRejection', (err: errorObject) => {
  console.log(err?.message);
  server.close(() => {
    process.exit(1);
  });
});
