import {style} from '@vanilla-extract/css'
import {themeClass, vars} from './theme.css.ts'
import {spacing} from './util.ts'

/**
 * The `rgb(1, 2, 3)` colour is a greppable marker the tests use to find this style's CSS in
 * the virtual `.vanilla.css` modules emitted by `processVanillaFile`.
 */
export const box: string = style({
  color: 'rgb(1, 2, 3)',
  padding: spacing,
  margin: vars.space,
  selectors: {
    [`${themeClass} &`]: {
      color: 'rgb(4, 5, 6)',
    },
  },
})
