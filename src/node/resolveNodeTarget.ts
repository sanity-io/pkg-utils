export function resolveNodeTarget(versions: string[]): string[] | undefined {
  const target: string[] = versions.filter((version) => version.startsWith('node'))

  if (target.length === 0) {
    return undefined
  }

  return target
}
