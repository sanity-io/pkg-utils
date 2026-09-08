import type {PackageJSON, PkgCssExport, PkgExport} from './types.ts'

/** @public */
export function parseExports(options: {pkg: PackageJSON}): (PkgExport & {_path: string})[] {
  const {pkg} = options
  const type = pkg.type || 'commonjs'

  if (pkg.source) {
  }

  if (!pkg.exports) {
    return []
  }

  const _exports: (PkgExport & {_path: string})[] = []

  for (const [exportPath, exportEntry] of Object.entries(pkg.exports)) {
    // `.css` subpaths are stylesheets, not JS entries - their `source` is compiled by the CSS
    // pipeline instead, and their conditions never carry `import`/`require` targets. See
    // `parseCssExports`.
    if (isCssExportPath(exportPath)) continue
    if (isPkgExport(exportEntry)) {
      const exp = {
        _exported: true,
        _path: exportPath,
        ...exportEntry,
      } satisfies PkgExport & {_path: string}

      // Infer the `default` condition based on the `type` and other conditions
      if (!exp.default) {
        const fallback = type === 'module' ? exp.import : exp.require

        if (fallback) {
          exp.default = fallback
        }
      }

      // Infer the `require` condition based on the `type` and other conditions
      if (!exp.require && type === 'commonjs' && exp.default) {
        exp.require = exp.default
      }

      // Infer the `import` condition based on the `type` and other conditions
      if (!exp.import && type === 'module' && exp.default) {
        exp.import = exp.default
      }

      _exports.push(exp)
    }
  }

  return _exports
}

/**
 * The `.css` export subpaths that declare a `source`, i.e. the stylesheets the CSS pipeline
 * builds into `dist` (as opposed to plain `.css` passthrough exports, which point at a file
 * that ships as-is, and to the generated conditional CSS exports, which have no `source`).
 *
 * The `source` is the entry the CSS pipeline compiles; the emitted stylesheet's path follows
 * the export subpath, so `"./ui/styles.css"` is built to `<dist>/ui/styles.css`.
 * @public
 */
export function parseCssExports(options: {pkg: PackageJSON}): (PkgCssExport & {_path: string})[] {
  const {pkg} = options
  if (!pkg.exports) return []

  const cssExports: (PkgCssExport & {_path: string})[] = []

  for (const [exportPath, exportEntry] of Object.entries(pkg.exports)) {
    if (!isCssExportPath(exportPath)) continue
    if (!isRecord(exportEntry)) continue
    // A conditional CSS export is a flat condition -> path map, so the non-string values a
    // malformed entry might carry are dropped rather than passed along as conditions.
    const conditions: Record<string, string> = {}
    for (const [condition, target] of Object.entries(exportEntry)) {
      if (typeof target === 'string') conditions[condition] = target
    }
    const source = conditions['source']
    if (source === undefined) continue
    cssExports.push({...conditions, _path: exportPath, source})
  }

  return cssExports
}

function isCssExportPath(exportPath: string): boolean {
  return exportPath.endsWith('.css')
}

function isPkgExport(value: unknown): value is PkgExport {
  return isRecord(value) && 'source' in value && typeof value['source'] === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object'
}
