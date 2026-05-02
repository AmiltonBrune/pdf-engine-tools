/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Runs before any module imports – patches process.stdout.write early
  setupFiles: ['<rootDir>/tests/setup-stdout.ts'],
  // Runs after Jest env is ready – patches console.*
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Silences ALL console output during tests (belt-and-suspenders)
  silent: true,
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
