import {isRecord} from '../isRecord.ts'

/**
 * Whether a CSS pipeline's options wire up the conditional CSS export pattern — the no-op JS
 * shim, its declaration file, and the `"./<fileName>"` export with `node`/`default` conditions
 * pointing at the shim.
 *
 * `pkg watch` needs this to decide which exports to maintain itself, because watch mode turns
 * tsdown's `exports` feature off. Full builds never ask: the plugins own the answer there.
 *
 * Kept in sync with `resolveCssExportOptions` in `@sanity/vanilla-extract-rolldown-plugin`,
 * with `@sanity/tsdown-config`'s `exports: {nodeCompat: true}` default already applied — the
 * same reason `cssShimFileName` has a copy here. Importing the canonical one would make
 * `@sanity/vanilla-extract-tsdown-plugin` a static dependency of this module graph, which
 * pulls the whole vanilla-extract toolchain into every `pkg build`.
 *
 * @internal
 */
export function usesCssExportNodeCompat(options: {
  inject?: unknown
  exports?: unknown
}): boolean {
  // An explicit `exports` wins over the deprecated `inject: {nodeCompat: true}` spelling
  if (options.exports !== undefined) {
    return isRecord(options.exports) && options.exports['nodeCompat'] === true
  }
  if (isRecord(options.inject)) {
    return options.inject['nodeCompat'] === true
  }
  // Neither is set, so `@sanity/tsdown-config`'s `exports: {nodeCompat: true}` default applies
  return true
}
