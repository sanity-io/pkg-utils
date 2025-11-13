import {expect, test} from 'vitest'
import {parseStrictOptions} from './strict.ts'

test.each([
  {key: 'noPackageJsonTypings', value: 'error', fails: false},
  {key: 'noPackageJsonTypings', value: 'warn', fails: false},
  {key: 'noPackageJsonTypings', value: 'off', fails: false},
  {key: 'noPackageJsonTypings', value: true, fails: true},
  {key: 'noPackageJsonTypings', value: false, fails: true},
  {key: 'noRootLevelMain', value: 'error', fails: false},
  {key: 'noRootLevelMain', value: 'warn', fails: false},
  {key: 'noRootLevelMain', value: 'off', fails: false},
  {key: 'noRootLevelMain', value: true, fails: true},
  {key: 'noRootLevelModule', value: 'error', fails: false},
  {key: 'noRootLevelModule', value: 'warn', fails: false},
  {key: 'noRootLevelModule', value: 'off', fails: false},
  {key: 'noRootLevelBrowser', value: 'error', fails: false},
  {key: 'noRootLevelBrowser', value: 'warn', fails: false},
  {key: 'noRootLevelBrowser', value: 'off', fails: false},
  {key: 'noRootLevelTypesVersions', value: 'error', fails: false},
  {key: 'noRootLevelTypesVersions', value: 'warn', fails: false},
  {key: 'noRootLevelTypesVersions', value: 'off', fails: false},
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
