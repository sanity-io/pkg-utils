import type {Options as PandacssPluginOptions} from '@sanity/pandacss-tsdown-plugin'
import {expectTypeOf, test} from 'vitest'
import type {PackagePandaOptions} from '../src/index.ts'

test('`PackagePandaOptions` mirrors the options of `@sanity/pandacss-tsdown-plugin`', () => {
  // The options are declared in this package rather than imported from the plugin, so the
  // published declarations don't depend on the optional peer (see `optional-peer-types.test.ts`
  // for the consumer side). This keeps the copy honest: the same option names, each with the
  // same type — checked by `tsc` and the type-aware lint, where the plugin is installed.
  expectTypeOf<PackagePandaOptions>().toEqualTypeOf<PandacssPluginOptions>()
})
