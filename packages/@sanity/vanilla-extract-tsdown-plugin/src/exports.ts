/**
 * Build the conditional CSS export object that the `inject` wiring expects, e.g.
 * ```json
 * {
 *   "browser": "./dist/bundle.css",
 *   "style": "./dist/bundle.css",
 *   "node": "./dist/bundle.css.js",
 *   "default": "./dist/bundle.css.js"
 * }
 * ```
 * @internal
 */
export function createConditionalCssExport(
  cssFileName: string,
  outDir: string,
): Record<string, string> {
  const cssFile = `./${outDir}/${cssFileName}`
  const shimFile = `./${outDir}/${cssFileName}.js`
  return {browser: cssFile, style: cssFile, node: shimFile, default: shimFile}
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
