import {style} from '@vanilla-extract/css'

/** Statically imported by `index.ts`; `rgb(1, 2, 3)` minifies to the `#010203` marker. */
export const box: string = style({
  color: 'rgb(1, 2, 3)',
})
