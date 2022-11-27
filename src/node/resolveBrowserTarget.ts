import {_PackageTargetVersions} from './_resolveBrowserslistVersions'

export function _resolveBrowserTarget(versions: _PackageTargetVersions): string[] | undefined {
  const target: string[] = []

  if (versions.chrome.length) {
    target.push(`chrome${versions.chrome[0]}`)
  }

  if (versions.ff.length) {
    target.push(`firefox${versions.ff[0]}`)
  }

  if (versions.edge.length) {
    target.push(`edge${versions.edge[0]}`)
  }

  if (versions.iosSaf.length) {
    target.push(`ios${versions.iosSaf[0]}`)
  }

  if (versions.saf.length) {
    target.push(`safari${versions.saf[0]}`)
  }

  if (versions.opera.length) {
    target.push(`opera${versions.opera[0]}`)
  }

  if (target.length === 0) {
    return undefined
  }

  return target
}
