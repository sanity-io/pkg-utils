import {style} from '@vanilla-extract/css'
import {accentColor} from './theme.ts'

/**
 * The colour value `rgb(1, 2, 3)` (via `theme.ts`) acts as a greppable marker — Vite's CSS
 * pipeline may minify it to `#010203` in builds.
 */
export const box: string = style({
  color: accentColor,
  padding: '8px',
})
