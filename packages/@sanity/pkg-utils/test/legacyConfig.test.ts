import {describe, expect, test} from 'vitest'
import {runLegacyConfigChecks} from '../src/node/core/config/legacyConfig'

describe('runLegacyConfigChecks', () => {
  test('rejects the removed `vanillaExtract` option with a pointer to the migration notes', () => {
    expect(() => runLegacyConfigChecks({vanillaExtract: true})).toThrow(
      /`vanillaExtract` option was removed in @sanity\/pkg-utils v14[\s\S]*MIGRATE\.md#v14-vanilla-extract-support-removed/,
    )
  })

  test('rejects `vanillaExtract` even when the other legacy checks are skipped', () => {
    expect(() => runLegacyConfigChecks({vanillaExtract: {}, legacyChecks: false})).toThrow(
      /`vanillaExtract` option was removed/,
    )
  })
})
