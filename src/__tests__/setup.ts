import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

// 1) Make dotenv-safe behave like dotenv during tests (loads .env.test, ignores .env.example)
jest.mock('dotenv-safe', () => ({
  config: (opts?: any) => {
    const dotenv = require('dotenv');
    return dotenv.config(opts);
  },
}));

// 2) Ensure AWS vars exist even if .env.test is missing something
process.env.AWS_BUCKET = process.env.AWS_BUCKET || 'dummy-bucket';
process.env.AWS_S3_REGION = process.env.AWS_S3_REGION || 'ap-southeast-1';
process.env.AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY || 'FAKE_ACCESS_KEY';
process.env.AWS_SCERET_KEY = process.env.AWS_SCERET_KEY || 'FAKE_SECRET_KEY'; // keep spelling to match your code

// 3) Stub multer-s3 so upload middleware never initialises real S3
jest.mock('multer-s3', () => {
  const mock = jest.fn(() => ({}));   // harmless storage object
  (mock as any).AUTO_CONTENT_TYPE = 'auto';
  return mock;
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://test-cdn.cloudfront.net';

jest.setTimeout(30000);
