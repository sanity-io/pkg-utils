// Namespace re-exports make the declaration bundler synthesize `declare namespace
// <module>_d_exports {…}` wrappers that userland can never tag — the `ae-missing-release-tag`
// check must skip them (https://github.com/sanity-io/pkg-utils/issues/3281)

// The `@sanity/client` `studioPath` pattern: an untagged namespace import re-exported as a
// named export below
import * as other from './other'

/** @alpha */
export * as inner from './inner'

export {other}

/** @public */
export const VERSION = '1.0.0'

// A user symbol colliding with the synthesized wrapper name: rolldown deconflicts one of the
// two, and the check must still skip the wrapper while checking this symbol
/** @public */
export const inner_d_exports: string = 'user symbol colliding with the synthesized wrapper name'
