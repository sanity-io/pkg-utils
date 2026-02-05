import type {PkgExport} from './config/types.ts'

/**
 * Gets the source path from an export entry.
 * Returns the value of `source` if it exists, otherwise returns `monorepo`.
 */
export function getSourcePath(exp: PkgExport): string | undefined {
  return exp.source || exp.monorepo
}

/**
 * Checks if an export has a source or monorepo path
 */
export function hasSourcePath(exp: PkgExport): boolean {
  return Boolean(exp.source || exp.monorepo)
}
