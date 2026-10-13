import {style} from '@vanilla-extract/css'

/** The loading overlay, the first style of `@sanity/ui` 4.4.2's `button.css.ts`. */
export const buttonLoadingBox: string = style({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  backgroundColor: 'var(--card-bg-color)',
})
