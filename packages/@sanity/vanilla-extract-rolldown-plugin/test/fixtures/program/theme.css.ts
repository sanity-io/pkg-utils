import {createGlobalTheme, createTheme} from '@vanilla-extract/css'

/**
 * Shared by `layout.css.ts` and `overrides.css.ts`. Per-module compilation bundles and evaluates
 * it once per importer; whole-program compilation once for the whole build. `rgb(10, 20, 30)`
 * is the greppable marker for its CSS.
 */
export const vars = createGlobalTheme(':root', {
  color: 'rgb(10, 20, 30)',
})

export const [themeClass, themeVars] = createTheme({
  accent: 'rgb(40, 50, 60)',
})
