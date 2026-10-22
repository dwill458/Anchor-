const path = require('path');

module.exports = {
  preset: 'jest-expo',
  rootDir: process.env.ANCHOR_PERF_HARNESS_ROOT || path.resolve(__dirname, '../../../../anchor/mobile'),
  roots: [path.resolve(__dirname)],
  testEnvironment: 'node',
  watchman: false,
  maxWorkers: 1,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo/virtual/env$': path.resolve(__dirname, 'test-shims/expo-virtual-env.cjs'),
  },
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
