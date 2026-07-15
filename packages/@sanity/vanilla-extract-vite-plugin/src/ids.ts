/**
 * Module id normalization ported from `@vanilla-extract/vite-plugin`
 * (MIT licensed, Copyright (c) 2021 SEEK).
 */
import {posix} from 'node:path'
import {normalizePath} from '@vanilla-extract/integration'

// Vite wraps module ids that aren't valid browser import specifiers with
// `/@id/` in dev mode. The leading slash is sometimes already stripped.
const viteIdPrefix = /^\/?@id\//

// Vite emits posix separators and sometimes prefixes a Windows drive letter
// with a slash, e.g. a resolved id like `/C:/...`.
const slashPrefixedDrive = /^\/([a-zA-Z]:\/)/

// A Windows drive path (`C:/...`) is unambiguously a real absolute path
// unlike a posix `/...` path, which may be an SSR root-relative id.
const windowsAbsolutePathRegex = /^[a-zA-Z]:\//

const isWindowsAbsolutePath = (filePath: string) => windowsAbsolutePathRegex.test(filePath)

const isAbsolutePath = (filePath: string) =>
  posix.isAbsolute(filePath) || isWindowsAbsolutePath(filePath)

/** Strip Vite's `@id/` wrapper and any slash it prefixes onto a Windows drive. */
function unwrapViteId(id: string): string {
  const unwrapped = id.replace(viteIdPrefix, '').replace(slashPrefixedDrive, '$1')

  // If unwrapping didn't yield an absolute path, the `@id/` prefix wasn't a
  // path wrapper, so keep the original id.
  return isAbsolutePath(unwrapped) ? unwrapped : id
}

/**
 * Resolves the absolute filesystem path behind a Vite module id: unwraps the dev-server `@id/`
 * wrapper, keeps real absolute paths (including Windows drive paths and monorepo paths outside
 * `root`), and joins SSR root-relative ids (`/app/styles.css.ts`) onto `root`.
 * @internal
 */
export function getAbsoluteId({filePath, root}: {filePath: string; root: string}): string {
  const resolvedId = unwrapViteId(filePath)

  if (
    // A Windows drive path is always a real absolute path.
    isWindowsAbsolutePath(resolvedId) ||
    resolvedId.startsWith(root) ||
    // In monorepos the absolute path is outside of `root`, so we check they
    // share a filesystem root. Vite paths always use posix separators.
    (posix.isAbsolute(resolvedId) && resolvedId.split(posix.sep)[1] === root.split(posix.sep)[1])
  ) {
    return normalizePath(resolvedId)
  }

  // In SSR mode we can have root-relative paths like `/app/styles.css.ts`. Note that unlike
  // `posix.resolve`, `posix.join` concatenates even when the second segment starts with `/`:
  // `posix.join('/root', '/app/styles.css.ts')` is `/root/app/styles.css.ts`.
  return normalizePath(posix.join(root, resolvedId))
}
