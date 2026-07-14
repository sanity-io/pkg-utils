import {style} from '@vanilla-extract/css'

/**
 * A vanilla-extract style with a distinctive, greppable declaration; `rgb(1, 2, 3)` is minified
 * by lightningcss to the `#010203` marker the tests look for.
 */
export const box: string = style({
  color: 'rgb(1, 2, 3)',
})
