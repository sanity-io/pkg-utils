import {style} from '@vanilla-extract/css'

/**
 * A vanilla-extract style with distinctive, greppable declarations. The colour value
 * `rgb(1, 2, 3)` acts as a marker (minified by lightningcss to `#010203`) that the tests use to
 * verify the CSS was extracted into `bundle.css` and stripped from the JS output, and the
 * `inset` shorthand is a marker for CSS syntax lowering: the config's `target: 'chrome61'`
 * predates `inset`, so it must be flattened into `top`/`right`/`bottom`/`left`.
 */
export const box: string = style({
  color: 'rgb(1, 2, 3)',
  border: '1px solid rgb(1, 2, 3)',
  padding: '8px',
  inset: 0,
})
