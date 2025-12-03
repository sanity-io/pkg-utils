import type {PackageJSON, PkgExport} from './types.ts'

/** @public */
export function parseExports(options: {pkg: PackageJSON}): (PkgExport & {_path: string})[] {
  const {pkg} = options
  const type = pkg.type || 'commonjs'

  if (pkg.source) {
    if (!pkg.exports && pkg.main) {
    }
  }

  if (!pkg.exports) {
    return []
  }

  const _exports: (PkgExport & {_path: string})[] = []

  for (const [exportPath, exportEntry] of Object.entries(pkg.exports)) {
    if (
      exportPath.endsWith('.json') ||
      (typeof exportEntry === 'string' && exportEntry.endsWith('.json'))
    ) {
    } else if (isRecord(exportEntry) && 'svelte' in exportEntry) {
      // @TODO should we report a warning or a debug message here about a detected svelte export that is ignored?
    } else if (isPkgExport(exportEntry)) {
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

      if (exportPath === '.') {
        if (exportEntry.require && pkg.main && exportEntry.require !== pkg.main) {
        }

        if (exportEntry.import && pkg.module && exportEntry.import !== pkg.module) {
        }
      }

      _exports.push(exp)
    } else if (!isRecord(exportEntry)) {
      //
    }
  }

  return _exports
}

function isPkgExport(value: unknown): value is PkgExport {
  return isRecord(value) && 'source' in value && typeof value['source'] === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object'
}
