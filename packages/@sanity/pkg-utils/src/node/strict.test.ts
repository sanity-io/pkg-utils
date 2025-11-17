import {expect, test} from 'vitest'
import {parseStrictOptions} from './strict.ts'

test.each([
  {key: 'noPackageJsonTypings', value: 'error', fails: false},
  {key: 'noPackageJsonTypings', value: 'warn', fails: false},
  {key: 'noPackageJsonTypings', value: 'off', fails: false},
  {key: 'noPackageJsonTypings', value: true, fails: true},
  {key: 'noPackageJsonTypings', value: false, fails: true},
  {key: 'noPackageJsonMain', value: 'error', fails: false},
  {key: 'noPackageJsonMain', value: 'warn', fails: false},
  {key: 'noPackageJsonMain', value: 'off', fails: false},
  {key: 'noPackageJsonMain', value: true, fails: true},
  {key: 'noPackageJsonModule', value: 'error', fails: false},
  {key: 'noPackageJsonModule', value: 'warn', fails: false},
  {key: 'noPackageJsonModule', value: 'off', fails: false},
  {key: 'noPackageJsonBrowser', value: 'error', fails: false},
  {key: 'noPackageJsonBrowser', value: 'warn', fails: false},
  {key: 'noPackageJsonBrowser', value: 'off', fails: false},
  {key: 'noPackageJsonTypesVersions', value: 'error', fails: false},
  {key: 'noPackageJsonTypesVersions', value: 'warn', fails: false},
  {key: 'noPackageJsonTypesVersions', value: 'off', fails: false},
  {key: 'preferModuleType', value: 'error', fails: false},
  {key: 'preferModuleType', value: 'warn', fails: false},
  {key: 'preferModuleType', value: 'off', fails: false},
])('{$key: $value}}', ({key, value, fails}) => {
  if (fails) {
    expect(() => parseStrictOptions({[key]: value})).toThrowErrorMatchingSnapshot()
  } else {
    expect(parseStrictOptions({[key]: value})).toMatchSnapshot()
  }
})
