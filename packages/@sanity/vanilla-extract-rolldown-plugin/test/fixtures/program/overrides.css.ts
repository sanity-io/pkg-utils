import {style} from '@vanilla-extract/css'
import {themeVars} from './theme.css.ts'

/** Imported after `panel.css.ts`; `rgb(4, 5, 6)` is its marker. */
export const shown: string = style({
  display: 'block',
  outlineColor: themeVars.accent,
  borderColor: 'rgb(4, 5, 6)',
})
