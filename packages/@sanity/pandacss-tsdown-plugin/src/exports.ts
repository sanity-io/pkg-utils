import path from 'node:path'

import type {UserConfig} from 'tsdown'

import {cssShimDtsFileName, cssShimFileName} from './cssShimFileName.ts'
import {type CssExportsOptions, normalizeCssExportsOptions} from './exportsOptions.ts'

type ExportsOptions = Extract<NonNullable<UserConfig['exports']>, object>
type CustomExportsFunction = Extract<
  NonNullable<ExportsOptions['customExports']>,
  (...args: never[]) => unknown
>
type ExportsSubpaths = Parameters<CustomExportsFunction>[0]
type CustomExportsContext = Parameters<CustomExportsFunction>[1]

/**
 * Default emitted CSS asset file name.
 *
 * @public
 */
export const DEFAULT_CSS_FILE_NAME = 'styles.css'

/**
 * Normalize an asset file name to a clean POSIX relative path (no leading
 * `./` or `/`, forward slashes only).
 *
 * @internal
 */
export function normalizeAssetFileName(fileName: string): string {
  const posixName = fileName.replace(/\\/g, '/').replace(/^(\.\/)+/, '')
  const normalized = path.posix.normalize(posixName).replace(/^\/+/, '')

  if (!normalized || normalized === '.' || normalized.startsWith('..')) {
    throw new Error(`Invalid Panda CSS asset fileName: "${fileName}"`)
  }

  return normalized
}

function toPosixRelativeOutDir(pkgRoot?: string, outDir?: string): string {
  if (!pkgRoot || !outDir) {
    return 'dist'
  }
  const rel = path.relative(pkgRoot, path.resolve(pkgRoot, outDir))
  const posixRel = rel.split(path.sep).join('/').replace(/^\/+/, '')

  return posixRel || 'dist'
}

/**
 * Build the `exports["./styles.css"]` value for the given `outDir` and
 * `fileName`.
 *
 * When `nodeCompat` is enabled (the default), returns a conditional export map
 * that routes the `"node"` condition to the emitted no-op JS shim (with a
 * nested `"types"` condition pointing at the `.d.ts` companion so TypeScript's
 * `node16`/`nodenext` resolver accepts the side-effect import without `TS2882`)
 * and every other condition to the real CSS file.
 *
 * @internal
 */
function buildCssExportEntry(
  relOutDir: string,
  normalizedFileName: string,
  options: {nodeCompat: boolean; conditions: readonly string[]},
): string | Record<string, string | Record<string, string>> {
  const cssTarget = `./${ path.posix.join(relOutDir, normalizedFileName)}`

  if (!options.nodeCompat) {
    return cssTarget
  }

  const shimTarget = `./${path.posix.join(relOutDir, cssShimFileName(normalizedFileName))}`
  const shimDtsTarget = `./${path.posix.join(relOutDir, cssShimDtsFileName(normalizedFileName))}`
  const entry: Record<string, string | Record<string, string>> = {}

  for (const condition of options.conditions) {
    entry[condition] =
      condition === 'node' ? {types: shimDtsTarget, default: shimTarget} : cssTarget
  }

  if (!('default' in entry)) {
    entry['default'] = cssTarget
  }

  return entry
}

/**
 * Return a new `UserConfig.exports` value that registers the emitted CSS
 * bundle (`"./<fileName>"` -> `"./<outDir>/<fileName>"`, or a conditional
 * export map when `nodeCompat` is enabled) in `customExports`, chained after
 * any user-supplied `customExports` callback.
 *
 * If `config.exports` is `false` or undefined (tsdown export generation is not
 * enabled), `config.exports` is returned unchanged unless `enableExports` is
 * set (`true` or a {@link CssExportsOptions} object).
 *
 * @internal
 */
export function withCssCustomExports(
  existingExports: UserConfig['exports'],
  fileName: string = DEFAULT_CSS_FILE_NAME,
  enableExports: boolean | CssExportsOptions = false,
  outDir?: string,
): UserConfig['exports'] {
  if (existingExports === false) {
    return existingExports
  }

  const normalizedExports = normalizeCssExportsOptions(enableExports, false)

  if (existingExports === undefined && !normalizedExports.enabled) {
    return existingExports
  }

  const normalizedFileName = normalizeAssetFileName(fileName)
  const exportKey = `./${normalizedFileName}`

  const resolvedExports: ExportsOptions =
    existingExports === undefined || existingExports === true
      ? {}
      : typeof existingExports === 'string'
        ? {enabled: existingExports}
        : existingExports
  const prevCustomExports = resolvedExports.customExports

  return {
    ...resolvedExports,
    async customExports(subpaths: ExportsSubpaths, context: CustomExportsContext) {
      const base =
        typeof prevCustomExports === 'function'
          ? await prevCustomExports(subpaths, context)
          : prevCustomExports
            ? {...subpaths, ...prevCustomExports}
            : subpaths
      const next: ExportsSubpaths = {...base}

      if (!(exportKey in next)) {
    const pkgRoot =
      typeof context === 'object' &&
      context !== null &&
      'pkgRoot' in context &&
      typeof context.pkgRoot === 'string'
        ? context.pkgRoot
        : undefined
    const ctxOutDir =
      typeof context === 'object' &&
      context !== null &&
      'outDir' in context &&
      typeof context.outDir === 'string'
        ? context.outDir
        : undefined
    const relOutDir = toPosixRelativeOutDir(pkgRoot, outDir ?? ctxOutDir)
        next[exportKey] = buildCssExportEntry(relOutDir, normalizedFileName, normalizedExports)
      }

      return next
    },
  }
}
