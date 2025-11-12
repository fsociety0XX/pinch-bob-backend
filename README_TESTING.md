# Testing Setup (Jest + Supertest + mongodb-memory-server)

This folder has been scaffolded for testing following your PDF.

## 1) Install dev dependencies

```bash
npm i -D jest @types/jest ts-jest supertest @types/supertest @shelf/jest-mongodb mongodb-memory-server @faker-js/faker
```

## 2) Config files created

- `jest.config.js`
- `jest-mongodb-config.js`
- `src/__tests__/setup.ts`

## 3) Example tests

- Unit: `src/__tests__/unit/utils/cdn.test.ts` (placeholder if no CDN utils found)
- Integration: `src/__tests__/integration/healthcheck.test.ts` (imports your app if detected: app.ts)


## 4) NPM scripts (add to package.json if not present)

```json
{
  "dev": "nodemon -r module-alias/register",
  "start:prod": "NODE_ENV=production NODE_OPTIONS='--max-old-space-size=4096' node -r module-alias/register ./dist/index.js",
  "start:stg": "NODE_ENV=development NODE_OPTIONS='--max-old-space-size=4096' node -r module-alias/register ./dist/index.js",
  "build": "tsc && copyfiles -u 1 src/templates/**/* dist",
  "build:prod": "env-cmd -f .env.production npm run build",
  "prepare": "husky install",
  "lint-staged": "lint-staged --config lint-staged.js",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:verbose": "jest --verbose",
  "test:unit": "jest --testPathPattern=__tests__/unit",
  "test:integration": "jest --testPathPattern=__tests__/integration"
}
```

## 5) Run tests

```bash
npm test
npm run test:coverage
npm run test:watch
```

> Note: Ensure your Express `app` is exported as default from `src/app.ts` (or update the import path in the integration test).
