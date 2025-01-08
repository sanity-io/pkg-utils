import type {PackageJSON, PkgBundle, PkgExport} from '../../core'

/** @internal */
export const fileEnding = /\.[mc]?js$/
/** @internal */
export const dtsEnding = '.d.ts' as const
/** @internal */
export const defaultEnding = '.js' as const
/** @internal */
export const legacyEnding = `.esm${defaultEnding}` as const
/** @internal */
export const mjsEnding = '.mjs' as const
/** @internal */
export const cjsEnding = '.cjs' as const
const mtsEnding = '.d.mts' as const
const ctsEnding = '.d.cts' as const

/** @internal */
export function getTargetPaths(
  _type: PackageJSON['type'],
  expOrBundle: PkgExport | PkgExport['browser'] | PkgExport['node'] | PkgBundle,
): string[] {
  const type = (_type === 'module' ? 'module' : 'commonjs') satisfies PackageJSON['type']

  const set = new Set<string>()

  if (expOrBundle?.import) {
    set.add(expOrBundle.import.replace(fileEnding, type === 'module' ? dtsEnding : mtsEnding))
  }

  if (expOrBundle?.require) {
    set.add(expOrBundle.require.replace(fileEnding, type === 'commonjs' ? dtsEnding : ctsEnding))
  }

  if (isPkgExport(expOrBundle)) {
    if (!expOrBundle.browser?.source) {
      if (expOrBundle.browser?.import) {
        set.add(
          expOrBundle.browser.import.replace(fileEnding, type === 'module' ? dtsEnding : mtsEnding),
        )
      }

      if (expOrBundle.browser?.require) {
        set.add(
          expOrBundle.browser.require.replace(
            fileEnding,
            type === 'commonjs' ? dtsEnding : ctsEnding,
          ),
        )
      }
    }

    if (!expOrBundle.node?.source) {
      if (expOrBundle.node?.import) {
        set.add(
          expOrBundle.node.import.replace(fileEnding, type === 'module' ? dtsEnding : mtsEnding),
        )
      }

      if (expOrBundle.node?.require) {
        set.add(
          expOrBundle.node.require.replace(fileEnding, type === 'commonjs' ? dtsEnding : ctsEnding),
        )
      }
    }
  }

  return Array.from(set)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPkgExport(exp: any): exp is PkgExport {
  return exp?.browser || exp?.node || exp?.default
}
