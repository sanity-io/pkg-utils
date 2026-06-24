import {style} from '@vanilla-extract/css'

/**
 * A vanilla-extract style with a distinctive, greppable declaration. The colour value
 * `rgb(1, 2, 3)` acts as a marker that can be used to manually verify that the extracted
 * `bundle.css` actually made it into a consumer's output. CI does not assert on this; the
 * smoke tests only verify that builds/imports do not crash.
 */
export const box = style({
  color: 'rgb(1, 2, 3)',
  border: '1px solid rgb(1, 2, 3)',
  padding: '8px',
})
