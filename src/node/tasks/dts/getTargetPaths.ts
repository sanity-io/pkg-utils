import type {PackageJSON, PkgBundle, PkgExport} from '../../core'

const fileEnding = /\.[mc]?js$/
const dtsEnding = '.d.ts'
const mtsEnding = '.d.mts'
const ctsEnding = '.d.cts'

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
