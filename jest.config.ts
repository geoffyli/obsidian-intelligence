import type {Config} from 'jest';

const config: Config = {
  preset:       'ts-jest',               // use ts-jest transformer
//   testEnvironment: 'jest-environment-obsidian', // ⬅️ swap to "node" if you mock manually
  roots:        ['<rootDir>/src/tests'],
  testMatch:    ['**/*.test.ts'],
  setupFilesAfterEnv: ['./jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist'], // ignore Rollup output
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
};

export default config;
