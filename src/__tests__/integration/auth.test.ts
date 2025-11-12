import request from 'supertest';
import app from '@src/app';
import User from '@src/models/userModel';
import { faker } from '@faker-js/faker';

describe('Auth Integration', () => {
  describe('POST /api/v1/auth/signup', () => {
    it('creates a new user', async () => {
      const userData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        phone: '+659' + faker.string.numeric(7),
        password: 'Test@1234',
        passwordConfirm: 'Test@1234',
        brand: 'bob',
      };

      const res = await request(app).post('/api/v1/auth/signup').send(userData);
      expect([200, 201]).toContain(res.status);
      expect(res.body).toBeDefined();

      if (res.body?.data?.user?.email) {
        expect(res.body.data.user.email).toBe(userData.email);
      }

      const created = await User.findOne({ email: userData.email });
      expect(created).toBeTruthy();
    });

    it('fails on duplicate email', async () => {
      const email = faker.internet.email();
      await User.create({
        firstName: 'John',
        lastName: 'Doe',
        email,
        phone: '+659' + faker.string.numeric(7),
        password: 'Test@1234',
        brand: 'bob',
      });

      const res = await request(app).post('/api/v1/auth/signup').send({
        firstName: 'Jane',
        lastName: 'Doe',
        email,
        phone: '+659' + faker.string.numeric(7),
        password: 'Test@1234',
        passwordConfirm: 'Test@1234',
        brand: 'bob',
      });

      expect([400, 409]).toContain(res.status);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs an existing user in', async () => {
      const password = 'Test@1234';
      const user = await User.create({
        firstName: 'Lara',
        lastName: 'Croft',
        email: faker.internet.email(),
        phone: '+659' + faker.string.numeric(7),
        password,
        brand: 'bob',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: user.email,
        password,
        brand: 'bob',
      });

      expect([200, 201]).toContain(res.status);
      expect(res.body?.token).toBeDefined();
      if (res.body?.data?.user?.email) {
        expect(res.body.data.user.email).toBe(user.email);
      }
    });
  });
});
