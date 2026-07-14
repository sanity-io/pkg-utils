import {style} from '@vanilla-extract/css'

/**
 * Reached through the intermediate `button.ts` module, which `index.ts` imports before
 * `styles.css.ts`, so the `rgb(4, 5, 6)` marker (minified to `#040506`) must precede the
 * `rgb(1, 2, 3)` marker of `styles.css.ts` in the extracted CSS bundle.
 */
export const button: string = style({
  color: 'rgb(4, 5, 6)',
})
