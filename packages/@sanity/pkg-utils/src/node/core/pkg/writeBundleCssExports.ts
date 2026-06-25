import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import type {Logger} from '../../logger.ts'

/**
 * Build the conditional CSS export object that vanilla-extract compat mode expects, e.g.
 * ```json
 * {
 *   "browser": "./dist/bundle.css",
 *   "style": "./dist/bundle.css",
 *   "node": "./dist/bundle.css.js",
 *   "default": "./dist/bundle.css.js"
 * }
 * ```
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
  const pkg = JSON.parse(source) as {exports?: Record<string, unknown>}

  // Normalize to POSIX separators - `path.relative` uses `\\` on Windows, but `exports` paths in
  // package.json must always use `/`.
  const distRel = (path.relative(cwd, distPath) || 'dist').split(path.sep).join('/')
  const exportKey = `./${cssName}`
  const cssFile = `./${path.posix.join(distRel, cssName)}`
  const shimFile = `./${path.posix.join(distRel, `${cssName}.js`)}`
  const conditionalExport = createConditionalCssExport(cssFile, shimFile)

  if (hasMatchingExport(pkg.exports?.[exportKey], conditionalExport)) {
    return
  }

  // Re-insert the css export (before `./package.json` when present) preserving the existing order.
  const nextExports: Record<string, unknown> = {}
  let inserted = false
  for (const [key, value] of Object.entries(pkg.exports ?? {})) {
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
  pkg.exports = nextExports

  await writeFile(pkgPath, `${JSON.stringify(pkg, null, detectIndent(source))}\n`)
  logger.log(`Updated package.json: added \`exports["${exportKey}"]\` for vanilla-extract compat mode`)
}
