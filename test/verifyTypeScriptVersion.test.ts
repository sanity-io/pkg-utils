import {expect, test} from 'vitest'

import apiExtractorJson from '@microsoft/api-extractor/package.json' assert {type: 'json'}
import pkgUtilsJson from '@sanity/pkg-utils/package.json' assert {type: 'json'}

/**
 * Why are we requiring the same version of TypeScript as @microsoft/api-extractor?
 * @microsoft/api-extractor is shipping with `typescript` in its `dependencies`.
 * We have it as a peer dependency in @sanity/pkg-utils.
 * As long as everything results in the same version of `typescript`, we're good.
 * But if they're different then weird issues can happen, that can be incredibly hard to debug in userland.
 * To avoid all this we're requiring the same version of `typescript` as @microsoft/api-extractor at all times,
 * while it's still possible to override it, as adhering to `peerDependencies` largely depends on which package
 * manager is being used and how it's configured, you'll still at least get helpful warnings if there's a mismatch.
 */

test('verify that @sanity/pkg-utils requires the same typescript version as @microsoft/api-extractor', () => {
  expect(pkgUtilsJson.devDependencies.typescript).toBe(apiExtractorJson.dependencies.typescript)
  expect(pkgUtilsJson.peerDependencies.typescript).toBe(apiExtractorJson.dependencies.typescript)
})
