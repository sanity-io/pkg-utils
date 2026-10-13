import {style} from '@vanilla-extract/css'

/** `@sanity/ui` 4.4.4 declares the Button root before the loading overlay of 4.4.2. */
export const buttonRoot: string = style({
  position: 'relative',
  display: 'inline-flex',
})

export const buttonLoadingBox: string = style({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  backgroundColor: 'var(--card-bg-color)',
})
