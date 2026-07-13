import {style} from '@vanilla-extract/css'

/** Only reached through the dynamic import; `rgb(7, 8, 9)` minifies to the `#070809` marker. */
export const lazyBox: string = style({
  color: 'rgb(7, 8, 9)',
})
