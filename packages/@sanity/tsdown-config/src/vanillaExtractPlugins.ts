import browserslistConfig from '@sanity/browserslist-config'
import {vanillaExtractPlugin} from '@vanilla-extract/rollup-plugin'
import type {Rolldown} from 'tsdown'
import {bundleCssShim} from './bundleCssShim.ts'
import {optimizeCss} from './optimizeCss.ts'
import type {ResolvedVanillaExtract} from './vanillaExtract.ts'

/**
 * Create the vanilla-extract plugin pipeline. This module is only loaded (through a dynamic
 * import) when the `vanillaExtract` option is enabled, so that neither
 * `@vanilla-extract/rollup-plugin` nor the CSS toolchain (`lightningcss`, `browserslist`) load for
 * configs that do not opt in.
 * @internal
 */
export function vanillaExtractPlugins(
  vanillaExtract: ResolvedVanillaExtract,
  cssName: string,
): (Rolldown.Plugin | false)[] {
  return [
    // Rolldown supports most Rollup plugins, but the plugin types are not identical, so the
    // official guidance is to cast: https://tsdown.dev/advanced/plugins#rollup-plugins
    // oxlint-disable-next-line no-unsafe-type-assertion
    vanillaExtractPlugin({
      identifiers: vanillaExtract.options.identifiers ?? 'short',
      cwd: vanillaExtract.options.cwd,
      esbuildOptions: vanillaExtract.options.esbuildOptions,
      unstable_injectFilescopes: vanillaExtract.options.unstable_injectFilescopes,
      extract: {
        name: cssName,
        sourcemap: vanillaExtract.options.extract?.sourcemap ?? true,
      },
    }) as unknown as Rolldown.Plugin,
    optimizeCss({
      extractFileName: cssName,
      browserslist: vanillaExtract.options.browserslist || browserslistConfig,
      minify: vanillaExtract.options.minify ?? true,
    }),
    // In compat mode, emit the no-op JS shim that the `node`/`default` conditions of the
    // `./<css>` export resolve to.
    vanillaExtract.compatMode && bundleCssShim({fileName: `${cssName}.js`}),
  ]
}
