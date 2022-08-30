import {_PackageTargetVersions} from './_parseBrowserslistVersions'

export function _parseNodeTarget(versions: _PackageTargetVersions): string[] | undefined {
  const target: string[] = []

  if (versions.node.length) {
    target.push(`node${versions.node[0]}`)
  }

  if (target.length === 0) {
    return undefined
  }

  return target
}
