jest.mock('@src/utils/sendTwilioOtp', () => ({
  __esModule: true,
  default: jest.fn(async () => undefined),
}));

jest.mock('@src/utils/sendEmail', () => ({
  __esModule: true,
  default: jest.fn(async () => undefined),
}));
