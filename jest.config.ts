/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/**/index.ts',
    '!src/workers/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'text-summary'],
  coverageThreshold: {
    global: { branches: 65, functions: 85, lines: 85, statements: 85 },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};
