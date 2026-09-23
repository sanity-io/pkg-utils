import {style} from '@vanilla-extract/css'
import {vars} from './theme.css.ts'

/**
 * Has a media-query rule (`display: none` at `rgb(1, 2, 3)`'s side) that `overrides.css.ts`'s
 * base rule beats under per-module compilation, because that module's CSS comes later in the
 * bundle - the ordering footgun whole-program compilation removes.
 */
export const panel: string = style({
  'color': vars.color,
  'backgroundColor': 'rgb(1, 2, 3)',
  '@media': {
    '(min-width: 600px)': {
      display: 'none',
    },
  },
})
