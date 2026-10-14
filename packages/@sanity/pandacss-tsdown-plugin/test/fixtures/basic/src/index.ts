import {css} from '#styled-system/css'

export const brandText: string = css({color: 'brand'})

// `rgb(1, 2, 3)` is a marker for the stylesheet tests: lightningcss normalizes it to `#010203`
export const marker: string = css({color: 'rgb(1, 2, 3)'})

// `inset` is lowered to `top`/`right`/`bottom`/`left` for targets that predate the shorthand
export const overlay: string = css({display: 'flex', inset: 0})
