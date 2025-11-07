export function resolveBrowserTarget(versions: string[]): string[] | undefined {
  const target: string[] = versions.filter(
    (version) =>
      version.startsWith('chrome') ||
      version.startsWith('edge') ||
      version.startsWith('firefox') ||
      version.startsWith('ios') ||
      version.startsWith('safari') ||
      version.startsWith('opera'),
  )

  if (target.length === 0) {
    return undefined
  }

  return target
}
