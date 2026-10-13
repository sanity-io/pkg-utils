import {style} from '@vanilla-extract/css'

/** v1: the overlay is the first style (index 0), mirroring `@sanity/ui` before 4.4.4. */
export const overlay: string = style({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  background: 'var(--card-bg-color)',
})

export const root: string = style({
  color: 'red',
})
