import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pi = require('./package.json')

export default {
  preset: 'ts-jest/presets/js-with-ts',
  globals: {
    VERSION: JSON.stringify(pi.version),
    TEST: true
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: ['**/__tests__/**/*.spec.ts'],
  transformIgnorePatterns: [
    '/node_modules/((?!(execa|strip-final-newline|npm-run-path|path-key|onetime|mimic-fn|human-signals|is-stream)/).)*$'
  ]
}
