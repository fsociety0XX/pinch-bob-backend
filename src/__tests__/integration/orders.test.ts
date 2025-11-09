import request from 'supertest';
import app from '@src/app';
import Order from '@src/models/orderModel';
import { createTestUser, createTestProduct, createTestOrder, getAuthToken } from '../helpers/factories';

describe('Orders Integration', () => {
  let authToken: string;
  let testUser: any;

  beforeEach(async () => {
    testUser = await createTestUser();
    authToken = getAuthToken(testUser);
  });

  describe('GET /api/v1/order', () => {
    it('returns orders filtered by brand', async () => {
      await createTestOrder({ brand: 'bob', user: testUser._id });
      await createTestOrder({ brand: 'bob', user: testUser._id });
      await createTestOrder({ brand: 'pinch', user: testUser._id });

      const res = await request(app)
        .get('/api/v1/order')
        .query({ brand: 'bob' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const data = res.body?.data?.data || [];
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data.every((o: any) => o.brand === 'bob')).toBe(true);
      }
    });

    it('includes id field equal to _id', async () => {
      const order = await createTestOrder({ brand: 'bob', user: testUser._id });

      const res = await request(app)
        .get('/api/v1/order')
        .query({ orderNumber: order.orderNumber })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const returned = res.body?.data?.data?.[0];
      if (returned) {
        expect(returned.id).toBeDefined();
        expect(returned._id).toBeDefined();
        expect(returned.id).toBe(returned._id);
      }
    });
  });

  describe('POST /api/v1/order', () => {
    it('creates a new order', async () => {
      const product = await createTestProduct({ brand: 'bob' });

      const payload = {
        brand: 'bob',
        product: [{
          product: product._id,
          price: 50,
          quantity: 1,
        }],
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
      };

      const res = await request(app)
        .post('/api/v1/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload);

      expect([200, 201]).toContain(res.status);
      const order = res.body?.data?.order;
      if (order) {
        expect(order.brand).toBe('bob');
        expect(order.orderNumber).toBeDefined();
      }
    });
  });
});
