import {describe, expect, test} from 'vitest'
import {usesCssExportNodeCompat} from '../src/node/core/pkg/cssExportOptions'

/** The subset of the `vanillaExtract`/`css` options these cases exercise. */
interface CssPipelineOptions {
  exports?: unknown
  inject?: unknown
  fileName?: string
  minify?: boolean
}

/**
 * `pkg watch` turns tsdown's `exports` feature off, so it decides for itself which conditional
 * CSS exports to maintain rather than asking the plugins. This is that decision, and it has to
 * agree with the plugin for every option shape, or watch mode and `pkg build` write different
 * `package.json` exports.
 *
 * The expectations below are the values `resolveCssExportOptions` in
 * `@sanity/vanilla-extract-rolldown-plugin` returns for
 * `{inject: true, exports: {nodeCompat: true}, ...userOptions}` — how `@sanity/tsdown-config`
 * composes the plugin options, defaults first and user last. They cannot be asserted against
 * the plugin directly: `@sanity/pkg-utils` deliberately does not depend on the vanilla-extract
 * packages, since importing them would pull the whole CSS toolchain into every build.
 */
describe('usesCssExportNodeCompat', () => {
  const defaultApplies: [CssPipelineOptions, boolean][] = [
    [{}, true],
    [{fileName: 'styles.css'}, true],
    [{minify: false}, true],
  ]
  test.each(defaultApplies)('%j → %s (the default applies)', (userOptions, expected) => {
    expect(usesCssExportNodeCompat(userOptions)).toBe(expected)
  })

  const injectCases: [CssPipelineOptions, boolean][] = [
    [{inject: false}, true],
    [{inject: true}, true],
    // The deprecated spelling still leaves the `exports` default in place, so the conditional
    // export is written either way. Reading `inject` here would get this pair backwards.
    [{inject: {nodeCompat: false}}, true],
    [{inject: {nodeCompat: true}}, true],
  ]
  test.each(injectCases)(
    '%j → %s (`inject` never clears the `exports` default)',
    (userOptions, expected) => {
      expect(usesCssExportNodeCompat(userOptions)).toBe(expected)
    },
  )

  const exportsCases: [CssPipelineOptions, boolean][] = [
    // `exports: true` publishes the CSS as a plain string export, with no shim to point at
    [{exports: true}, false],
    [{exports: {}}, false],
    [{exports: {nodeCompat: false}}, false],
    [{exports: false}, false],
    [{exports: {nodeCompat: true}}, true],
  ]
  test.each(exportsCases)(
    '%j → %s (an explicit `exports` replaces the default)',
    (userOptions, expected) => {
      expect(usesCssExportNodeCompat(userOptions)).toBe(expected)
    },
  )
})
