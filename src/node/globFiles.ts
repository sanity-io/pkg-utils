import path from 'node:path'

import globby from 'globby'

export function globFiles(patterns: string[]): Promise<string[]> {
  return globby(patterns.map((pattern) => pattern.split(path.sep).join(path.posix.sep)))
}
