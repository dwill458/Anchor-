const path = require('node:path');
const mobile = path.resolve(__dirname, '../../../../anchor/mobile');
const base = require(path.join(mobile, 'jest.config.js'));
module.exports = {
  ...base,
  rootDir: mobile,
  roots: [__dirname],
  testMatch: ['**/*.gate.test.ts'],
  moduleDirectories: [path.join(mobile, 'node_modules'), 'node_modules'],
};
