import {isRecord} from '../isRecord.ts'

/**
 * Whether a CSS pipeline's options wire up the conditional CSS export pattern — the no-op JS
 * shim, its declaration file, and the `"./<fileName>"` export whose `node`/`default` conditions
 * point at the shim.
 *
 * `pkg watch` needs this to decide which exports to maintain itself, because watch mode turns
 * tsdown's `exports` feature off. Full builds never ask: the plugins own the answer there.
 *
 * Only `exports` decides. `@sanity/tsdown-config` composes the plugin options as
 * `{inject: true, exports: {nodeCompat: true}, ...userOptions}`, so `exports` is always set by
 * the time `resolveCssExportOptions` sees them — a user-supplied `inject` never clears the
 * default. That makes the plugin's compatibility fallback for the deprecated
 * `inject: {nodeCompat: true}` spelling unreachable from here, and reading `inject` would get
 * `{inject: {nodeCompat: false}}` wrong: it still leaves the `exports` default in place, so the
 * conditional export is written.
 *
 * Kept in sync with `resolveCssExportOptions` in `@sanity/vanilla-extract-rolldown-plugin` —
 * the same reason `cssShimFileName` has a copy here. Importing the canonical one would make
 * `@sanity/vanilla-extract-tsdown-plugin` a static dependency of this module graph, pulling the
 * whole vanilla-extract toolchain into every `pkg build`.
 *
 * @internal
 */
export function usesCssExportNodeCompat(options: {exports?: unknown}): boolean {
  if (options.exports === undefined) {
    // `@sanity/tsdown-config`'s `exports: {nodeCompat: true}` default applies
    return true
  }
  return isRecord(options.exports) && options.exports['nodeCompat'] === true
}
