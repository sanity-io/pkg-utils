import globby from 'globby'

export function _globFiles(patterns: string[]): Promise<string[]> {
  return globby(patterns)
}
