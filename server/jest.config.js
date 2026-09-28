module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/tests/setup-env.ts'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 15000,
};