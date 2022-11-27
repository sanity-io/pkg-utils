import {PackageTargetVersions} from './resolveBrowserslistVersions'

export function resolveNodeTarget(versions: PackageTargetVersions): string[] | undefined {
  const target: string[] = []

  if (versions.node.length) {
    target.push(`node${versions.node[0]}`)
  }

  if (target.length === 0) {
    return undefined
  }

  return target
}
