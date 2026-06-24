import {describe, expect, test} from 'vitest'
import {parseStrictOptions} from './strict.ts'

describe.skipIf(process.platform === 'win32')('strict options', () => {
  test.each([
    {key: 'noPackageJsonTypings', value: 'error', fails: false},
    {key: 'noPackageJsonTypings', value: 'warn', fails: false},
    {key: 'noPackageJsonTypings', value: 'off', fails: false},
    {key: 'noPackageJsonTypings', value: true, fails: true},
    {key: 'noPackageJsonTypings', value: false, fails: true},
    {key: 'noPackageJsonBrowser', value: 'error', fails: false},
    {key: 'noPackageJsonBrowser', value: 'warn', fails: false},
    {key: 'noPackageJsonBrowser', value: 'off', fails: false},
    {key: 'noPackageJsonTypesVersions', value: 'error', fails: false},
    {key: 'noPackageJsonTypesVersions', value: 'warn', fails: false},
    {key: 'noPackageJsonTypesVersions', value: 'off', fails: false},
    {key: 'preferModuleType', value: 'error', fails: false},
    {key: 'preferModuleType', value: 'warn', fails: false},
    {key: 'preferModuleType', value: 'off', fails: false},
    {key: 'noReactIsPeerDependency', value: 'off', fails: false},
    {key: 'noReactIsPeerDependency', value: true, fails: true},
    {key: 'noSanityUiPeerDependency', value: 'off', fails: false},
    {key: 'noSanityDependency', value: 'off', fails: false},
    {key: 'noStyledComponentsDependency', value: 'off', fails: false},
    {key: 'noReactDependency', value: 'off', fails: false},
    {key: 'noReactDomDependency', value: 'off', fails: false},
    {key: 'noReactTypesDependency', value: 'off', fails: false},
    {key: 'noReactDomTypesDependency', value: 'off', fails: false},
    {key: 'noNodeTypesDependency', value: 'off', fails: false},
    {key: 'noRxjsPeerDependency', value: 'off', fails: false},
    {key: 'noSanityClientPeerDependency', value: 'off', fails: false},
  ])('{$key: $value}}', ({key, value, fails}) => {
    if (fails) {
      expect(() => parseStrictOptions({[key]: value})).toThrowErrorMatchingSnapshot()
    } else {
      expect(parseStrictOptions({[key]: value})).toMatchSnapshot()
    }
  })
})
