import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import type {Logger} from '../../logger.ts'
import {isRecord} from '../isRecord.ts'
import {createConditionalCssExport} from './cssExport.ts'

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
 * Write the conditional `"./<cssName>"` export of every CSS file to `package.json` (used by
 * `exports.nodeCompat`), so userland does not have to maintain it by hand. The write is
 * idempotent: if every export already matches, the file is left untouched.
 *
 * Full builds write these entries through tsdown's `exports.customExports` (the
 * `@sanity/vanilla-extract-tsdown-plugin` composition, and the `@sanity/tsdown-config` one for
 * `@tsdown/css` output), but watch mode disables tsdown's `exports` feature (a `package.json`
 * write per rebuild would loop the watcher) — `pkg watch` calls this once per context instead,
 * like v11 did.
 *
 * When `publishConfig.exports` is present, the same conditional CSS exports are mirrored into it.
 * A conditional CSS export has no `source`/`development`/`monorepo` conditions to strip, so the
 * entries are identical in both places — except for a hand-written `source`, which stays in
 * `exports` only. Keeping them in sync prevents the `publishConfig.exports` validation from
 * failing with a "missing export path" error for the auto-added `./<cssName>` exports.
 *
 * @internal
 */
export async function writeBundleCssExports(options: {
  cwd: string
  distPath: string
  cssNames: string[]
  /** Hand-written `source` conditions to preserve in `exports`, keyed by export subpath. */
  sources?: Record<string, string>
  logger: Logger
}): Promise<void> {
  const {cwd, distPath, cssNames, sources = {}, logger} = options
  if (cssNames.length === 0) return

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

  // Only mirror into `publishConfig.exports` when it already exists; never create it here.
  const publishConfig = pkg.publishConfig
  const publishConfigExports = isRecord(publishConfig?.exports) ? publishConfig.exports : undefined

  const written: string[] = []
  let exports = pkg.exports ?? {}
  let publishExports = publishConfigExports

  for (const cssName of cssNames) {
    const exportKey = `./${cssName}`
    const publishExport = createConditionalCssExport(cssName, distRel)
    // A hand-written `source` resolves at development time only, so it stays out of the
    // publish map — the same split `composeExports` applies to build entries.
    const sourceCondition = sources[exportKey]
    const localExport =
      sourceCondition === undefined ? publishExport : {source: sourceCondition, ...publishExport}

    const exportsMatch = hasMatchingExport(exports[exportKey], localExport)
    const publishExportsMatch =
      !publishExports || hasMatchingExport(publishExports[exportKey], publishExport)
    if (exportsMatch && publishExportsMatch) continue

    exports = insertCssExport(exports, exportKey, localExport)
    if (publishExports) {
      publishExports = insertCssExport(publishExports, exportKey, publishExport)
    }
    written.push(exportKey)
  }

  if (written.length === 0) return

  pkg.exports = exports
  if (publishConfig && publishExports) {
    publishConfig.exports = publishExports
  }

  await writeFile(pkgPath, `${JSON.stringify(pkg, null, detectIndent(source))}\n`)
  const maps = publishConfigExports ? ['exports', 'publishConfig.exports'] : ['exports']
  const keys = maps
    .flatMap((map) => written.map((key) => `\`${map}["${key}"]\``))
    .join(', ')
    .replace(/, ([^,]*)$/, written.length * maps.length > 1 ? ' and $1' : '$1')
  logger.log(
    `Updated package.json: added ${keys} for the conditional CSS export pattern`,
  )
}
