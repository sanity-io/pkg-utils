import {expect, test} from 'vitest'
import {parseStrictOptions} from './strict'

test.each([
  {key: 'noPackageJsonTypings', value: 'error', fails: false},
  {key: 'noPackageJsonTypings', value: 'warn', fails: false},
  {key: 'noPackageJsonTypings', value: 'off', fails: false},
  {key: 'noPackageJsonTypings', value: true, fails: true},
  {key: 'noPackageJsonTypings', value: false, fails: true},
])('{$key: $value}}', ({key, value, fails}) => {
  if (fails) {
    expect(() => parseStrictOptions({[key]: value})).toThrowErrorMatchingSnapshot()
  } else {
    expect(parseStrictOptions({[key]: value})).toMatchSnapshot()
  }
})
