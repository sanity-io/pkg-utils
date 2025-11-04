/**
 * Normalizes a path to use forward slashes (POSIX-style) for cross-platform consistency.
 * This is particularly important for Windows where backslashes are used.
 *
 * @param filePath - The path to normalize
 * @returns The path with forward slashes
 */
export function normalizePath(filePath: string): string {
  // Replace all backslashes with forward slashes
  return filePath.replace(/\\/g, '/')
}
