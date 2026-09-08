import path from 'node:path'
import {cssShimDtsFileName, cssShimFileName} from './cssShimFileName.ts'

/**
 * Build the conditional CSS export object that `exports.nodeCompat` expects, e.g.
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
 *
 * Kept in sync with `createConditionalCssExport` in `@sanity/vanilla-extract-tsdown-plugin`,
 * which writes the same entry through tsdown's `exports.customExports` during full builds.
 *
 * @internal
 */
export function createConditionalCssExport(
  cssName: string,
  distRel: string,
): Record<string, string> {
  const cssFile = `./${path.posix.join(distRel, cssName)}`
  const shimFile = `./${path.posix.join(distRel, cssShimFileName(cssName))}`
  const shimDtsFile = `./${path.posix.join(distRel, cssShimDtsFileName(cssName))}`
  return {types: shimDtsFile, browser: cssFile, style: cssFile, node: shimFile, default: shimFile}
}
