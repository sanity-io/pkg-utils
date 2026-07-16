import {style} from '@vanilla-extract/css'
import {accentColor} from './theme'

/**
 * Mirrors the real-world regression fixed by the integration suite: the Google Maps input
 * dialog styles of `@sanity/google-maps-input` lost their `height: 40rem` rule in `sanity
 * build` output while the class name stayed on the element
 * ({@link https://github.com/sanity-io/pkg-utils/issues/3073}).
 */
export const veStudioDialog: string = style({
  color: accentColor,
  height: '40rem',
})

/** `inset` is lowered to `top`/`right`/`bottom`/`left` by old `cssTarget`s like `chrome61`. */
export const veStudioOverlay: string = style({
  position: 'absolute',
  inset: 0,
})
