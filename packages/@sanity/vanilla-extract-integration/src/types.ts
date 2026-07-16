import type {Adapter} from '@vanilla-extract/css'

/**
 * Identifier formatting for generated class names, keyframes, CSS vars, etc:
 * `'short'` (bare hashes), `'debug'` (file/debug-name prefixed hashes), or a custom formatter.
 * The same type as upstream `@vanilla-extract/integration`.
 * @public
 */
export type IdentifierOption = ReturnType<Adapter['getIdentOption']>
