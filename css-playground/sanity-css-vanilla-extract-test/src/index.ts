import {createElement, type ReactElement} from 'react'
import {box} from './styles.css'

/**
 * Marker logged by {@link createConfig}. Smoke tests assert this string is printed to verify the
 * module actually executed (and therefore the side-effectful `import "<pkg>/bundle.css"` ran)
 * instead of being tree-shaken away.
 * @public
 */
export const CREATE_CONFIG_MESSAGE = 'sanity-css-vanilla-extract-test: createConfig() called'

/**
 * A shim entry point for non-React and Node-like contexts (e.g. importing this package in a
 * `next.config.ts`, during SSR, or in a plain Node script). Calling it logs {@link CREATE_CONFIG_MESSAGE}.
 *
 * The whole point of this package is to exercise the self-referential `import "<pkg>/bundle.css"`
 * statement that is injected into the built entry chunk. In CSS-unaware runtimes that import must
 * resolve to the no-op JS shim (via conditional exports) rather than crash with
 * `Error: Unknown file extension ".css"`.
 * @public
 */
export function createConfig(): {marker: string} {
  // eslint-disable-next-line no-console
  console.log(CREATE_CONFIG_MESSAGE)
  return {marker: CREATE_CONFIG_MESSAGE}
}

/**
 * A React component that applies the extracted vanilla-extract styles.
 * @public
 */
export function TestComponent(): ReactElement {
  return createElement(
    'div',
    {className: box, 'data-testid': 'sanity-css-vanilla-extract-test'},
    'sanity-css-vanilla-extract-test',
  )
}
