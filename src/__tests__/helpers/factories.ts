import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import User from '@src/models/userModel';
import Product from '@src/models/productModel';
import Order from '@src/models/orderModel';

/** Create a test user with sensible defaults */
export const createTestUser = async (overrides: any = {}) => {
  const user = await User.create({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    phone: `+659${faker.string.numeric(7)}`,
    password: 'Test@1234',
    brand: 'bob',
    ...overrides,
  });
  return user;
};

/** Create a test product */
export const createTestProduct = async (overrides: any = {}) => {
  const product = await Product.create({
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: faker.number.int({ min: 20, max: 100 }),
    brand: 'bob',
    inventory: 10,
    ...overrides,
  });
  return product;
};

/** Create a test order */
export const createTestOrder = async (overrides: any = {}) => {
  const userId = overrides.user || (await createTestUser())._id;

  const order = await Order.create({
    orderNumber: `ORD-${faker.string.numeric(6)}`,
    brand: 'bob',
    user: userId,
    product: [],
    delivery: {
      date: new Date(Date.now() + 86400000),
      collectionTime: '10:00 AM - 12:00 PM',
    },
    pricingSummary: {
      subTotal: '50',
      gst: '3.5',
      deliveryCharge: '0',
      total: '53.5',
    },
    paid: true,
    ...overrides,
  });
  return order;
};

/** Get a JWT for the user (aligns with tests where protect middleware is used) */
export const getAuthToken = (user: any) => {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret';
  return jwt.sign({ id: user._id }, secret, { expiresIn: '1h' });
};
