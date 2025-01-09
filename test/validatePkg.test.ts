import {expect, test} from 'vitest'

import {validatePkg} from '../src/node/core/pkg/validatePkg'

const template = {
  type: 'module',
  name: 'dummy-module',
  version: '0.0.0',
  license: 'MIT',
  exports: {
    './package.json': './package.json',
  },
}

test.each([
  {actual: 'Exports' as const, expected: 'exports', value: {'./package.json': './package.json'}},
  {actual: 'Type', expected: 'type', value: 'module'},
  {actual: 'Dependencies', expected: 'dependencies', value: {}},
  {actual: 'devdependencies', expected: 'devDependencies', value: {}},
  {actual: 'peerdependencies', expected: 'peerDependencies', value: {}},
  {actual: 'Source', value: './src/index.ts'},
  {actual: 'Main', value: './dist/index.js'},
  {actual: 'Browser', value: {}},
  {actual: 'Module', value: './dist/index.js'},
  {actual: 'Types', value: './dist/index.js'},
  {
    actual: 'typesversions',
    expected: 'typesVersions',
    value: {
      '*': {
        extra: ['./dist/extra.d.ts'],
      },
    },
  },
])('$actual is not a valid key, did you mean $expected?', ({actual, expected, value}) => {
  const pkg = {
    ...template,
    [actual]: value,
  }

  expect(() => validatePkg(pkg)).toThrowError(/is not a valid key/)
  expect(() => validatePkg(pkg)).toThrowErrorMatchingSnapshot()
  expect(() => validatePkg({...template, [expected as string]: value})).not.toThrow()
})

test('conditional imports must be prefixed with #', () => {
  expect(() =>
    validatePkg({
      ...template,
      imports: {
        env: {
          browser: './src/index.browser.ts',
          default: './src/index.ts',
        },
      },
    }),
  ).toThrowErrorMatchingSnapshot()
  expect(
    validatePkg({
      ...template,
      imports: {
        '#env': {
          browser: './src/index.browser.ts',
          default: './src/index.ts',
        },
      },
    }),
  ).toMatchSnapshot()
})
