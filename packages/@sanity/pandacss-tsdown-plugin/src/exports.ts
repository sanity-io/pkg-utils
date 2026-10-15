import path from 'node:path'
import type {PackageJsonWithPath, UserConfig} from 'tsdown'
import {cssShimDtsFileName, cssShimFileName} from './cssShimFileName.ts'
import {normalizeCssExportsOptions, type CssExportsOptions} from './exportsOptions.ts'

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

function findEmittedOutDir(
  chunks: CustomExportsContext['chunks'] | undefined,
  normalizedFileName: string,
): string | undefined {
  if (!chunks || typeof chunks !== 'object') return undefined
  let fallbackOutDir: string | undefined
  for (const formatChunks of Object.values(chunks)) {
    if (!Array.isArray(formatChunks)) continue
    for (const chunk of formatChunks) {
      if (
        !chunk ||
        typeof chunk !== 'object' ||
        typeof chunk.outDir !== 'string' ||
        !chunk.outDir
      ) {
        continue
      }
      fallbackOutDir ??= chunk.outDir
      if (chunk.type === 'asset' && chunk.fileName.replace(/\\/g, '/') === normalizedFileName) {
        return chunk.outDir
      }
    }
  }
  return fallbackOutDir
}

function resolveRelativeOutDir(
  context: CustomExportsContext | undefined,
  normalizedFileName: string,
  configuredOutDir?: string,
): string {
  const pkg: Partial<PackageJsonWithPath> | undefined = context?.pkg
  const packageJsonPath =
    typeof pkg?.packageJsonPath === 'string' && pkg.packageJsonPath.length > 0
      ? pkg.packageJsonPath
      : undefined
  const pkgRoot = packageJsonPath ? path.dirname(path.resolve(packageJsonPath)) : undefined
  const rawOutDir = findEmittedOutDir(context?.chunks, normalizedFileName) ?? configuredOutDir

  if (!rawOutDir) {
    return 'dist'
  }

  if (pkgRoot) {
    const resolvedOutDir = path.resolve(pkgRoot, rawOutDir)
    const rel = path.relative(pkgRoot, resolvedOutDir).replace(/\\/g, '/')
    if (!rel || rel === '.') {
      return ''
    }
    return path.posix
      .normalize(rel)
      .replace(/^(\.\/)+/, '')
      .replace(/^\/+|\/+$/g, '')
  }

  if (path.isAbsolute(rawOutDir)) {
    const rel = path.relative(process.cwd(), rawOutDir).replace(/\\/g, '/')
    if (!rel || rel === '.') {
      return ''
    }
    return path.posix
      .normalize(rel)
      .replace(/^(\.\/)+/, '')
      .replace(/^\/+|\/+$/g, '')
  }

  const posixOutDir = path.posix
    .normalize(rawOutDir.replace(/\\/g, '/'))
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+|\/+$/g, '')

  return posixOutDir === '.' ? '' : posixOutDir
}

function formatExportTarget(relOutDir: string, fileName: string): string {
  const joined = relOutDir ? path.posix.join(relOutDir, fileName) : fileName
  const normalized = path.posix
    .normalize(joined)
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '')
  return `./${normalized}`
}

/**
 * Build the `exports["./styles.css"]` value for the given `outDir` and
 * `fileName`.
 *
 * When `nodeCompat` is enabled (the default), returns a conditional export map
 * with a top-level `"types"` condition (for `moduleResolution: "bundler"` under
 * `noUncheckedSideEffectImports`) and a `"node"` condition routing to the
 * emitted no-op JS shim (with a nested `"types"` condition for
 * `node16`/`nodenext`), while every other condition routes to the real CSS file.
 *
 * @internal
 */
function buildCssExportEntry(
  relOutDir: string,
  normalizedFileName: string,
  options: {nodeCompat: boolean; conditions: readonly string[]},
): string | Record<string, string | Record<string, string>> {
  const cssTarget = formatExportTarget(relOutDir, normalizedFileName)

  if (!options.nodeCompat) {
    return cssTarget
  }

  const shimTarget = formatExportTarget(relOutDir, cssShimFileName(normalizedFileName))
  const shimDtsTarget = formatExportTarget(relOutDir, cssShimDtsFileName(normalizedFileName))
  const entry: Record<string, string | Record<string, string>> = {
    types: shimDtsTarget,
  }

  for (const condition of options.conditions) {
    if (condition === 'types') {
      entry['types'] = shimDtsTarget
      continue
    }
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
 * Note that tsdown 0.23.1+ pre-populates `subpaths["./<fileName>"]` with a
 * plain CSS path before invoking `customExports`, so this helper upgrades that
 * entry unless the user's own `customExports` explicitly overrode it.
 *
 * @internal
 */
export function withCssCustomExports(
  existingExports: UserConfig['exports'],
  fileName: string = DEFAULT_CSS_FILE_NAME,
  enableExports?: boolean | CssExportsOptions,
  outDir?: string,
): UserConfig['exports'] {
  if (existingExports === false || enableExports === false) {
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
      const initialCssExport = subpaths[exportKey]
      const base =
        typeof prevCustomExports === 'function'
          ? await prevCustomExports({...subpaths}, context)
          : prevCustomExports
            ? {...subpaths, ...prevCustomExports}
            : subpaths
      const next: ExportsSubpaths = {...base}

      const userOverrodeCssExport =
        prevCustomExports !== undefined &&
        (typeof prevCustomExports === 'function'
          ? base[exportKey] !== initialCssExport
          : exportKey in prevCustomExports)

      if (!userOverrodeCssExport) {
        const relOutDir = resolveRelativeOutDir(context, normalizedFileName, outDir)
        next[exportKey] = buildCssExportEntry(relOutDir, normalizedFileName, normalizedExports)
      }

      return next
    },
  }
}
