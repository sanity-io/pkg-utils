// A binding-less, side-effect-only import of an *external* package subpath. This mirrors
// real-world usage such as `import 'react-time-ago/locale/en'` where importing the module
// performs a side effect (registering a locale). The bundler must preserve this import in the
// output instead of tree-shaking it away.
// oxlint-disable-next-line no-unassigned-import
import 'dummy-side-effects/side-effect'

/** @public */
export const answer = 42
