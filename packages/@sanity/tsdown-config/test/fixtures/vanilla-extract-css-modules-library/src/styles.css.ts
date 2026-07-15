import {style} from '@vanilla-extract/css'

/**
 * Vanilla-extract style with the same greppable markers as the other fixtures. Extracted into
 * `bundle.css` by `vanillaExtract`, independently of the CSS-modules pipeline.
 */
export const box: string = style({
  color: 'rgb(1, 2, 3)',
  border: '1px solid rgb(1, 2, 3)',
  padding: '8px',
  inset: 0,
})
