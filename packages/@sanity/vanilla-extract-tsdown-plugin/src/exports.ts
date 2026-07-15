import {cssShimDtsFileName, cssShimFileName} from '@sanity/vanilla-extract-rolldown-plugin'

/**
 * Build the conditional CSS export object that the `inject` wiring expects, e.g.
 * ```json
 * {
 *   "types": "./dist/bundle-css.d.ts",
 *   "browser": "./dist/bundle.css",
 *   "style": "./dist/bundle.css",
 *   "node": "./dist/bundle-css.js",
 *   "default": "./dist/bundle-css.js"
 * }
 * ```
 * The shim is named `bundle-css.js` (not `bundle.css.js`) so it does not match
 * vanilla-extract's `cssFileFilter`. An explicit `types` condition (rather than relying on
 * TypeScript's extension-substitution fallback, which only works when the shim shares the CSS
 * file's basename, and which TypeScript is deprecating anyway - microsoft/TypeScript#50762)
 * points resolvers straight at the shim's declaration file.
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
  conditionalExport: Record<string, string>,
): Record<string, unknown> {
  const nextExports: Record<string, unknown> = {}
  let inserted = false
  for (const [key, value] of Object.entries(exports)) {
    if (key === exportKey) continue
    if (key === './package.json' && !inserted) {
      nextExports[exportKey] = conditionalExport
      inserted = true
    }
    nextExports[key] = value
  }
  if (!inserted) {
    nextExports[exportKey] = conditionalExport
  }
  return nextExports
}
