import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import type {Logger} from '../../logger.ts'
import {isRecord} from '../isRecord.ts'
import {cssShimFileName} from './cssShimFileName.ts'

/**
 * Build the conditional CSS export object that vanilla-extract compat mode expects, e.g.
 * ```json
 * {
 *   "browser": "./dist/bundle.css",
 *   "style": "./dist/bundle.css",
 *   "node": "./dist/bundle-css.js",
 *   "default": "./dist/bundle-css.js"
 * }
 * ```
 * The shim is named `bundle-css.js` (not `bundle.css.js`) so it does not match
 * vanilla-extract's `cssFileFilter`.
 */
function createConditionalCssExport(cssFile: string, shimFile: string) {
  return {browser: cssFile, style: cssFile, node: shimFile, default: shimFile}
}

function hasMatchingExport(value: unknown, expected: Record<string, string>): boolean {
  if (typeof value !== 'object' || value === null) return false
  const actual = Object.fromEntries(Object.entries(value))
  const keys = Object.keys(expected)
  return (
    keys.length === Object.keys(actual).length && keys.every((key) => actual[key] === expected[key])
  )
}

/**
 * Insert (or replace) the `"./<cssName>"` export in an `exports`-shaped map, preserving the existing
 * order and placing it before `./package.json` when present.
 */
function insertCssExport(
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

function detectIndent(source: string): string | number {
  const match = source.match(/\n([ \t]+)\S/)
  if (!match) return 2
  const indent = match[1]!
  return indent.includes('\t') ? '\t' : indent.length
}

/**
 * Write the conditional `"./<cssName>"` export to `package.json` (used by vanilla-extract compat
 * mode), so userland does not have to maintain it by hand. The write is idempotent: if the export
 * already matches, the file is left untouched.
 *
 * When `publishConfig.exports` is present, the same conditional CSS export is mirrored into it. The
 * conditional CSS export has no `source`/`development`/`monorepo` conditions to strip, so the entry
 * is identical in both places. Keeping them in sync prevents the `publishConfig.exports` validation
 * from failing with a "missing export path" error for the auto-added `./<cssName>` export.
 *
 * @internal
 */
export async function writeBundleCssExports(options: {
  cwd: string
  distPath: string
  cssName: string
  logger: Logger
}): Promise<void> {
  const {cwd, distPath, cssName, logger} = options

  const pkgPath = path.resolve(cwd, 'package.json')
  const source = await readFile(pkgPath, 'utf8')
  // oxlint-disable-next-line no-unsafe-type-assertion
  const pkg = JSON.parse(source) as {
    exports?: Record<string, unknown>
    publishConfig?: {exports?: Record<string, unknown>}
  }

  // Normalize to POSIX separators - `path.relative` uses `\\` on Windows, but `exports` paths in
  // package.json must always use `/`.
  const distRel = (path.relative(cwd, distPath) || 'dist').split(path.sep).join('/')
  const exportKey = `./${cssName}`
  const cssFile = `./${path.posix.join(distRel, cssName)}`
  const shimFile = `./${path.posix.join(distRel, cssShimFileName(cssName))}`
  const conditionalExport = createConditionalCssExport(cssFile, shimFile)

  // Only mirror into `publishConfig.exports` when it already exists; never create it here.
  const publishConfig = pkg.publishConfig
  const publishConfigExports = isRecord(publishConfig?.exports) ? publishConfig.exports : undefined

  const exportsMatch = hasMatchingExport(pkg.exports?.[exportKey], conditionalExport)
  const publishConfigExportsMatch =
    !publishConfigExports || hasMatchingExport(publishConfigExports[exportKey], conditionalExport)

  if (exportsMatch && publishConfigExportsMatch) {
    return
  }

  pkg.exports = insertCssExport(pkg.exports ?? {}, exportKey, conditionalExport)

  if (publishConfig && publishConfigExports) {
    publishConfig.exports = insertCssExport(publishConfigExports, exportKey, conditionalExport)
  }

  await writeFile(pkgPath, `${JSON.stringify(pkg, null, detectIndent(source))}\n`)
  logger.log(
    `Updated package.json: added \`exports["${exportKey}"]\`${
      publishConfigExports ? ` and \`publishConfig.exports["${exportKey}"]\`` : ''
    } for vanilla-extract compat mode`,
  )
}
