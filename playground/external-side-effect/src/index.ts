// A binding-less, side-effect-only import of an *external* package subpath.
// This mirrors real-world usage such as `import 'react-time-ago/locale/en'`
// where importing the module performs a side effect (registering a locale).
//
// The bundler must preserve this import in the output. Previously pkg-utils set
// `treeshake.moduleSideEffects` to the equivalent of `'no-external'`, which
// dropped these imports from the published bundle and broke consumers.
// oxlint-disable-next-line no-unassigned-import
import 'dummy-side-effects/side-effect'

/** @public */
export const answer = 42
