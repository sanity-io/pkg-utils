import path from 'node:path'

// Inlined from @rollup/pluginutils via @vanilla-extract/integration (both MIT):
// https://github.com/rollup/plugins/blob/33174f956304ab4aad4bbaba656f627c31679dc5/packages/pluginutils/src/normalizePath.ts#L5-L7
/**
 * Normalizes Windows path separators to POSIX ones.
 * @public
 */
export const normalizePath = (filename: string): string =>
  filename.split(path.win32.sep).join(path.posix.sep)
