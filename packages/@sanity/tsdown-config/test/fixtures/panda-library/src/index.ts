import {css} from '#styled-system/css'

/**
 * The class names of the box. Their rules live in the extracted stylesheet, which the entry
 * chunks load through the injected `@fixtures/panda-library/bundle.css` import.
 */
export function getBoxClassName(): string {
  return css({color: 'brand', display: 'flex', inset: 0})
}

// The raw color is a marker for the tests (lightningcss normalizes it in the stylesheet), and
// `inset` above is lowered to `top`/`right`/`bottom`/`left` for the fixture's `chrome61` target
export const markerClassName: string = css({color: 'rgb(1, 2, 3)'})
