import {style} from '@vanilla-extract/css'

/** A second vanilla-extract module; `rgb(4, 5, 6)` (or minified `#040506`) is its marker. */
const base = style({
  color: 'rgb(4, 5, 6)',
  margin: '10px',
})

/** A composed style, so class-list composition is part of the compared output. */
export const veStudioButton: string = style([
  base,
  {
    fontWeight: 600,
  },
])
