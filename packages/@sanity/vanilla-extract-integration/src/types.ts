import type {Adapter} from '@vanilla-extract/css'

/**
 * Identifier formatting for generated class names, keyframes, CSS vars, etc:
 * `'short'` (bare hashes), `'debug'` (file/debug-name prefixed hashes), or a custom formatter.
 * The same type as upstream `@vanilla-extract/integration`.
 * @public
 */
export type IdentifierOption = ReturnType<Adapter['getIdentOption']>

/**
 * The `identifiers` option of the `@sanity/vanilla-extract-*` plugins: an
 * {@link IdentifierOption}, or `'safe'` — `'short'` identifiers whose file-scope hash also covers
 * the package version, so that releases of a package never share a class name. Turn it into an
 * {@link IdentifierOption} with {@link resolveIdentifierOption}.
 * @public
 */
export type PluginIdentifierOption = IdentifierOption | 'safe'
