import {style} from '@vanilla-extract/css'

/**
 * A vanilla-extract style with distinctive, greppable declarations. The colour value
 * `rgb(1, 2, 3)` acts as a marker (normalized by lightningcss to `#010203`) that the tests use
 * to verify the CSS was extracted, and the `inset` shorthand is a marker for CSS syntax
 * lowering (old targets flatten it into `top`/`right`/`bottom`/`left`).
 */
export const box: string = style({
  color: 'rgb(1, 2, 3)',
  inset: 0,
})
