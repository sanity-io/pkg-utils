import apiExtractorJson from '@microsoft/api-extractor/package.json' assert {type: 'json'}
import pkgUtilsJson from '@sanity/pkg-utils/package.json' assert {type: 'json'}
import {satisfies} from 'semver'
import {expect, test} from 'vitest'

test('verify that @sanity/pkg-utils requires the same typescript minor as @microsoft/api-extractor', () => {
  expect(
    satisfies(apiExtractorJson.dependencies.typescript, pkgUtilsJson.peerDependencies.typescript),
  ).toBe(true)
})
