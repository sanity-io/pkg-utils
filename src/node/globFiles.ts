import globby from 'globby'
import path from 'path'

export function globFiles(patterns: string[]): Promise<string[]> {
  return globby(patterns.map((pattern) => pattern.split(path.sep).join(path.posix.sep)))
}
