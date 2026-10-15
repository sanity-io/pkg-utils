import path from 'node:path'
import {cssShimDtsFileName, cssShimFileName} from './cssShim.ts'

/**
 * The path of the output directory relative to the package directory, with POSIX separators
 * and without `.` segments (`''` when the output is the package root), which is what the
 * targets of a package's `exports` must be built from.
 * @internal
 */
export function packageRelativeOutDir(packageJsonPath: string, outDir: string): string {
  const packageDir = path.dirname(packageJsonPath)
  const relative = path.relative(packageDir, outDir).replaceAll('\\', '/')
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(
      `[pandacss] \`exports\` can only publish the stylesheet from inside the package, but the output directory ${outDir} is outside ${packageDir}.`,
    )
  }
  return relative
}

/** A package `exports` target for a file in the output directory, e.g. `"./dist/styles.css"`. */
function exportTarget(outDir: string, fileName: string): string {
  return `./${path.posix.join(outDir, fileName)}`
}

/**
 * Build the plain CSS export target of `exports: true`, e.g. `"./dist/styles.css"`, from the
 * output directory relative to the package (see {@link packageRelativeOutDir}). Enough for
 * packages that only run in browsers or bundlers; `exports: {nodeCompat: true}` uses
 * {@link createConditionalCssExport} instead so the subpath also resolves in Node.
 * @internal
 */
export function createCssExport(cssFileName: string, outDir: string): string {
  return exportTarget(outDir, cssFileName)
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
