/**
 * Options for the `package.json#exports` entry generated for the emitted CSS
 * bundle (`"./styles.css"` by default).
 *
 * @public
 */
export interface CssExportsOptions {
  /**
   * Emit a no-op JS shim (`dist/styles-css.js`) and wire the CSS export entry as
   * a conditional object so runtimes that resolve the `"node"` condition load
   * the no-op instead of failing with `ERR_UNKNOWN_FILE_EXTENSION` on `.css`:
   *
   * ```json
   * "./styles.css": {
   *   "types": "./dist/styles-css.d.ts",
   *   "style": "./dist/styles.css",
   *   "browser": "./dist/styles.css",
   *   "module": "./dist/styles.css",
   *   "node": {
   *     "types": "./dist/styles-css.d.ts",
   *     "default": "./dist/styles-css.js"
   *   },
   *   "default": "./dist/styles.css"
   * }
   * ```
   *
   * Set to `false` to emit a plain string export (`"./styles.css": "./dist/styles.css"`).
   *
   * @defaultValue `true`
   */
  nodeCompat?: boolean
  /**
   * Condition order for the conditional export object when `nodeCompat` is
   * enabled.
   *
   * A top-level `"types"` condition pointing at `./<outDir>/styles-css.d.ts` is
   * always placed first so TypeScript (`moduleResolution: "bundler"` with
   * `noUncheckedSideEffectImports`) resolves the declaration before matching
   * runtime conditions. Each condition name in `conditions` then maps to
   * `./<outDir>/<fileName>`, except `"node"` which maps to
   * `{types: "./<outDir>/styles-css.d.ts", default: "./<outDir>/styles-css.js"}`.
   *
   * @defaultValue `['style', 'browser', 'module', 'node', 'default']`
   */
  conditions?: readonly string[]
}

/**
 * Default condition order for the conditional `./styles.css` export when
 * `nodeCompat` is enabled.
 *
 * @public
 */
export const DEFAULT_CSS_EXPORT_CONDITIONS = [
  'style',
  'browser',
  'module',
  'node',
  'default',
] as const

/**
 * @internal
 */
export interface NormalizedCssExportsOptions {
  enabled: boolean
  nodeCompat: boolean
  conditions: readonly string[]
}

/**
 * @internal
 */
export function normalizeCssExportsOptions(
  exportsOption: boolean | CssExportsOptions | undefined,
  defaultEnabled = false,
): NormalizedCssExportsOptions {
  if (exportsOption === undefined) {
    return {
      enabled: defaultEnabled,
      nodeCompat: true,
      conditions: DEFAULT_CSS_EXPORT_CONDITIONS,
    }
  }
  if (typeof exportsOption === 'boolean') {
    return {
      enabled: exportsOption,
      nodeCompat: exportsOption,
      conditions: DEFAULT_CSS_EXPORT_CONDITIONS,
    }
  }
  return {
    enabled: true,
    nodeCompat: exportsOption.nodeCompat ?? true,
    conditions: exportsOption.conditions ?? DEFAULT_CSS_EXPORT_CONDITIONS,
  }
}
