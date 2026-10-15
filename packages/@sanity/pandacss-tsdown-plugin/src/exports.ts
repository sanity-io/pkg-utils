import path from 'node:path'
import {cssShimDtsFileName, cssShimFileName} from './cssShimFileName.ts'

/**
 * Normalize an output directory given relative to the package root into the form the export
 * targets embed: POSIX separators, no `./` prefix or trailing slash, and `''` for the root
 * itself (`'dist'`, `'./dist'`, `'dist/'`, `'lib\\esm'`, `'.'` → `'dist'`, `'dist'`, `'dist'`,
 * `'lib/esm'`, `''`). An absolute directory cannot be made relative here — resolve it against
 * the package root first, like the plugin's `tsdownConfig` hook does.
 */
function normalizeOutDir(outDir: string): string {
  const normalized = path.posix.normalize(outDir.replaceAll('\\', '/')).replace(/\/+$/, '')
  return normalized === '.' || normalized === '' ? '' : normalized.replace(/^\.\//, '')
}

/** `./<outDir>/<file>`, or `./<file>` when the output directory is the package root. */
function exportTarget(outDir: string, fileName: string): string {
  const dir = normalizeOutDir(outDir)
  return dir ? `./${dir}/${fileName}` : `./${fileName}`
}

/**
 * Build the plain CSS export target of `exports: true`, e.g. `"./dist/bundle.css"`. Enough for
 * packages that only run in browsers or bundlers; `exports: {nodeCompat: true}` uses
 * {@link createConditionalCssExport} instead so the subpath also resolves in Node. `outDir` is
 * the output directory relative to the package root, in any spelling (`dist`, `./dist`,
 * `lib/esm`, or `''`/`.` for the root).
 * @internal
 */
export function createCssExport(cssFileName: string, outDir: string): string {
  return exportTarget(outDir, cssFileName)
}

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
 * The shim is named `bundle-css.js` (not `bundle.css.js`) so no CSS pipeline treats it as a
 * stylesheet module (see {@link cssShimFileName}). An explicit `types` condition (rather than relying on
 * TypeScript's extension-substitution fallback, which only works when the shim shares the CSS
 * file's basename, and which TypeScript is deprecating anyway - microsoft/TypeScript#50762)
 * points resolvers straight at the shim's declaration file.
 * @internal
 */
export function createConditionalCssExport(
  cssFileName: string,
  outDir: string,
): Record<string, string> {
  const cssFile = exportTarget(outDir, cssFileName)
  const shimFile = exportTarget(outDir, cssShimFileName(cssFileName))
  const shimDtsFile = exportTarget(outDir, cssShimDtsFileName(cssFileName))
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
  conditionalExport: Record<string, string> | string,
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
