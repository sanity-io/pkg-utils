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
   * Each condition name maps to `./<outDir>/<fileName>`, except `"node"` which
   * maps to `{types: "./<outDir>/styles-css.d.ts", default: "./<outDir>/styles-css.js"}`.
   *
   * Why this default order:
   * - `"style"` first: standard CSS condition recognized by CSS-aware tools
   *   (Vite, Webpack `css-loader`, Parcel, LightningCSS, etc.).
   * - `"browser"` and `"module"` before `"node"`: client bundlers (esbuild,
   *   Rollup, Webpack, Vite) activate `"browser"` and/or `"module"` on client
   *   builds, and some also include `"node"` as a fallback condition — placing
   *   `"browser"`/`"module"` ahead of `"node"` ensures they always receive the
   *   real CSS file.
   * - `"node"` before `"default"`: Node.js (`import`), `vitest` (`environment:
   *   'node'` / `'jsdom'`), Next.js SSR, and `tsc --moduleResolution bundler`
   *   (whose default conditions are `["module", "types"]` — or `["node", ...]`
   *   for `node16`/`nodenext`) hit `"node"` (or `"module"` for bundler-mode
   *   typecheck) instead of failing on a raw `.css` file.
   * - `"default"` last: catch-all for any other tool (`unpkg`, Deno, etc.).
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
      nodeCompat: true,
      conditions: DEFAULT_CSS_EXPORT_CONDITIONS,
    }
  }
  return {
    enabled: true,
    nodeCompat: exportsOption.nodeCompat ?? true,
    conditions: exportsOption.conditions ?? DEFAULT_CSS_EXPORT_CONDITIONS,
  }
}
