import {style} from '@vanilla-extract/css'

/** A second vanilla-extract module; `rgb(4, 5, 6)` (or minified `#040506`) is its marker. */
export const button: string = style({
  color: 'rgb(4, 5, 6)',
})
