import {cssShimDtsFileName, cssShimFileName} from './cssShim.ts'

/**
 * Build the plain CSS export target of `exports: true`, e.g. `"./dist/styles.css"`. Enough for
 * packages that only run in browsers or bundlers; `exports: {nodeCompat: true}` uses
 * {@link createConditionalCssExport} instead so the subpath also resolves in Node.
 * @internal
 */
export function createCssExport(cssFileName: string, outDir: string): string {
  return `./${outDir}/${cssFileName}`
}

/**
 * Build the conditional CSS export object that `exports.nodeCompat` expects, e.g.
 * ```json
 * {
 *   "types": "./dist/styles-css.d.ts",
 *   "browser": "./dist/styles.css",
 *   "style": "./dist/styles.css",
 *   "node": "./dist/styles-css.js",
 *   "default": "./dist/styles-css.js"
 * }
 * ```
 * @internal
 */
export function createConditionalCssExport(
  cssFileName: string,
  outDir: string,
): Record<string, string> {
  const cssFile = `./${outDir}/${cssFileName}`
  const shimFile = `./${outDir}/${cssShimFileName(cssFileName)}`
  const shimDtsFile = `./${outDir}/${cssShimDtsFileName(cssFileName)}`
  return {types: shimDtsFile, browser: cssFile, style: cssFile, node: shimFile, default: shimFile}
}

/**
 * Insert (or replace) the `"./<cssFileName>"` export in an `exports`-shaped map, preserving the
 * existing order and placing it before `./package.json` when present. Used with tsdown's
 * `exports.customExports` so both `exports` and `publishConfig.exports` receive the entry.
 * @internal
 */
export function insertCssExport(
  exports: Record<string, unknown>,
  exportKey: string,
  cssExport: Record<string, string> | string,
): Record<string, unknown> {
  const nextExports: Record<string, unknown> = {}
  let inserted = false
  for (const [key, value] of Object.entries(exports)) {
    if (key === exportKey) continue
    if (key === './package.json' && !inserted) {
      nextExports[exportKey] = cssExport
      inserted = true
    }
    nextExports[key] = value
  }
  if (!inserted) {
    nextExports[exportKey] = cssExport
  }
  return nextExports
}
