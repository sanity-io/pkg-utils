import globby from 'globby'

export function globFiles(patterns: string[]): Promise<string[]> {
  return globby(patterns)
}
