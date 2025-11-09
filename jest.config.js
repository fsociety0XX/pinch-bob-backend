module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
      diagnostics: false, // avoid “union type too complex” from Mongoose
    },
  },
  moduleNameMapper: { '^@src/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/mocks/external.mocks.ts',      
    '<rootDir>/src/__tests__/setup.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/server.ts',
    '!src/crons/**',
    '!src/__tests__/setup.ts',
  ],
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/__tests__/setup.ts'],
};
