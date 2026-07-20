/**
 * A real vanilla-extract stylesheet that only enters the module graph through the lazily
 * loaded `PlainCssJsInput` component, so under `sanity dev` with `unstable_bundledDev` it is
 * compiled on demand (after the initial bundle) rather than at startup — covering the general
 * "vanilla-extract module in an on-demand chunk" case alongside the fake `Styles.css.js` of
 * `plain-css-js-dependency`.
 */
import {style} from '@vanilla-extract/css'

export const veStudioLazyBadge: string = style({
  color: 'rgb(7, 8, 9)',
  outlineOffset: '0.7rem',
})
