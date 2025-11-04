import path from 'node:path'

/**
 * Normalizes a path to use forward slashes (POSIX-style) for cross-platform consistency.
 * This is particularly important for Windows where path.sep is '\'.
 *
 * @param filePath - The path to normalize
 * @returns The path with forward slashes
 */
export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep)
}
