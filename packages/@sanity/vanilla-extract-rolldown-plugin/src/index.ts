import browserslistConfig from '@sanity/browserslist-config'
import type {IdentifierOption} from '@vanilla-extract/integration'
import type {Plugin} from 'rolldown'
import {cssShim} from './cssShim.ts'
import {extractPlugin} from './extract.ts'
import {optimizeCss} from './optimizeCss.ts'

/** The default name of the extracted CSS file. */
const DEFAULT_CSS_NAME = 'bundle.css'

/**
 * Options for {@link vanillaExtractPlugin}.
 * @public
 */
export interface Options {
  /**
   * Different formatting of identifiers (e.g. class names, keyframes, CSS Vars, etc).
   * @defaultValue "short"
   */
  identifiers?: IdentifierOption
  /**
   * Extract the CSS into a separate file. The CSS is always extracted, so this configures _how_.
   */
  extract?: {
    /**
     * Name of the emitted `.css` file (and, with `compatMode`, the base name of the JS shim).
     * @defaultValue "bundle.css"
     */
    name?: string
    /**
     * Generate a `.css.map` sourcemap file.
     * @defaultValue true
     */
    sourcemap?: boolean
    /**
     * Emit a no-op `<name>.js` shim (plus a `<name>.d.ts` declaration) next to the extracted CSS,
     * for the `node`/`default` conditions of a conditional `./<name>` export to point at, so that
     * `import "<pkg>/<name>"` resolves to a harmless module in runtimes that cannot import `.css`
     * files. Disable it if you don't use the conditional CSS export pattern.
     * @defaultValue true
     */
    compatMode?: boolean
  }
  /**
   * Minify the extracted CSS with `lightningcss`.
   * @defaultValue true
   */
  minify?: boolean
  /**
   * Browserslist query passed to `lightningcss` when optimizing the extracted CSS.
   * @defaultValue `@sanity/browserslist-config`
   */
  browserslist?: string | string[]
}

/**
 * A rolldown-native vanilla-extract plugin that compiles `.css.ts` modules and extracts their CSS
 * into a single `lightningcss`-optimized asset. Unlike `@vanilla-extract/rollup-plugin` it doesn't
 * declare `rollup` as a peer dependency, and it uses plugin hook filters so rolldown skips the
 * Rust ↔ JS roundtrip for modules that aren't vanilla-extract related.
 * @public
 */
export function vanillaExtractPlugin(options: Options = {}): Plugin[] {
  const identifiers = options.identifiers ?? 'short'
  const name = options.extract?.name ?? DEFAULT_CSS_NAME
  const sourcemap = options.extract?.sourcemap ?? true
  const compatMode = options.extract?.compatMode ?? true
  const minify = options.minify ?? true

  const plugins = [
    extractPlugin({identifiers, name, sourcemap}),
    optimizeCss({
      extractFileName: name,
      browserslist: options.browserslist || browserslistConfig,
      minify,
    }),
  ]
  if (compatMode) {
    plugins.push(cssShim({fileName: `${name}.js`}))
  }
  return plugins
}
