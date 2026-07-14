import {style} from '@vanilla-extract/css'

/**
 * Styles with markers for the browserslist-fallback tests:
 *
 * - `rgb(1, 2, 3)` is normalized to `#010203` whenever lightningcss processes the CSS with
 *   targets (with `minify: false` it would pass through untouched if the node-only `target`
 *   disabled the processing).
 * - `light-dark()` is a modern color function that lightningcss lowers to a custom-property
 *   polyfill for the browsers of `@sanity/browserslist-config`.
 */
export const box: string = style({
  color: 'rgb(1, 2, 3)',
  backgroundColor: 'light-dark(rgb(255, 255, 255), rgb(0, 0, 0))',
})
