import {style, styleVariants} from '@vanilla-extract/css'
import {recipe} from '@vanilla-extract/recipes'
import {createSprinkles, defineProperties} from '@vanilla-extract/sprinkles'
import {baseCard, componentLayer, theme, vars} from './base.css.ts'

// The a / b / c example: `a` and `b` share `padding: 0`; `c` cannot share `display: block` with
// `a` because `b`'s `display: inline` sits between them.
export const a = style({display: 'block', padding: 0})
export const b = style({display: 'inline', padding: 0})
export const c = style({display: 'block'})

// Shorthand / longhand in both orders: the longhand is a barrier for the shorthand's run, and
// the authored order inside one style is preserved.
export const shorthandThenLonghand = style({padding: 0, paddingBottom: 4})
export const paddingAgain = style({padding: 0})
export const longhandThenShorthand = style({paddingBottom: 4, padding: 0})

// Pseudos and `&&` keep their selector shape; `& + &` stays on the identity class.
export const interactive = style({
  'color': 'rgb(1, 2, 3)',
  ':hover': {color: 'rgb(4, 5, 6)'},
  '::before': {content: '""'},
  'selectors': {
    '&&': {opacity: 0.9},
    '& + &': {marginTop: 8},
    [`${theme} &`]: {color: 'rgb(7, 8, 9)'},
  },
})

// Media queries keep the authored precedence between queries.
export const responsive = style({
  '@media': {
    'screen and (min-width: 640px)': {padding: 16},
    'screen and (min-width: 1024px)': {padding: 24},
  },
})
export const responsiveToo = style({
  '@media': {
    'screen and (min-width: 640px)': {padding: 16},
    'screen and (min-width: 1024px)': {padding: 24},
  },
})

// Layers: a layered declaration is not a barrier for an unlayered run and vice versa.
export const layered = style({
  '@layer': {
    [componentLayer]: {padding: 4},
  },
})
export const paddingAfterLayer = style({padding: 0})

// `!important` and normal declarations of one property don't compete by order.
export const important = style({margin: '0 !important'})
export const marginNormal = style({margin: 4})
export const importantAgain = style({margin: '0 !important'})

// Compositions expand each member; the composition's own class comes first.
export const composed = style([a, {color: 'rgb(1, 2, 3)'}])
export const pureComposition = style([a, b])

// Cross-file sharing (whole-program mode only): the same declarations as `baseCard`.
export const card = style({display: 'flex', padding: 0})
export const usesVars = style({gap: vars.space})

export const tone = styleVariants({
  neutral: {color: 'rgb(1, 2, 3)'},
  critical: [baseCard, {color: 'rgb(4, 5, 6)'}],
})

export const button = recipe({
  base: {display: 'inline-flex', padding: 0},
  variants: {
    size: {
      small: {padding: 4},
      large: {padding: 8},
    },
  },
  defaultVariants: {size: 'small'},
})

const properties = defineProperties({
  properties: {
    display: ['none', 'flex'],
    padding: {none: 0, small: 4},
  },
})
export const sprinkles = createSprinkles(properties)
