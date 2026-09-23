import {createTheme, layer, style} from '@vanilla-extract/css'

export const [theme, vars] = createTheme({
  space: '8px',
})

export const componentLayer = layer('components')

/**
 * `gap` is declared again by `usesVars` in `entry.css.ts` with nothing overlapping in between,
 * so whole-program mode shares it across the file boundary; `display` and `padding` are not
 * shared, since entry's own styles declare other values for them first.
 */
export const baseCard = style({
  display: 'flex',
  padding: 0,
  gap: vars.space,
})
