import {style} from '@vanilla-extract/css'
import {recipe} from '@vanilla-extract/recipes'
import {createSprinkles, defineProperties} from '@vanilla-extract/sprinkles'
import {base, card} from './styles.css.ts'
import {vars} from './theme.css.ts'

export {base, card} from './styles.css.ts'

export const button = recipe({
  base: {
    display: 'inline-flex',
    padding: 0,
    borderRadius: 4,
  },
  variants: {
    tone: {
      neutral: {color: vars.color.brand},
      critical: {color: vars.color.accent},
    },
    size: {
      small: {padding: 4},
      large: {padding: 8, paddingInline: 12},
    },
    disabled: {
      true: {opacity: 0.5},
    },
  },
  compoundVariants: [
    {
      variants: {tone: 'critical', size: 'large'},
      style: {fontWeight: 700},
    },
  ],
  defaultVariants: {tone: 'neutral', size: 'small'},
})

export const stringBaseRecipe = recipe({
  base: card,
  variants: {
    raised: {
      true: [base, {boxShadow: '0 1px 2px rgb(0 0 0 / 20%)'}],
    },
  },
})

const responsiveProperties = defineProperties({
  conditions: {
    mobile: {},
    tablet: {'@media': 'screen and (min-width: 768px)'},
  },
  defaultCondition: 'mobile',
  properties: {
    display: ['none', 'flex', 'block'],
    padding: {
      small: vars.space.small,
      medium: vars.space.medium,
      none: 0,
    },
    paddingTop: {
      small: vars.space.small,
      medium: vars.space.medium,
    },
  },
  shorthands: {
    p: ['padding'],
  },
})

export const sprinkles = createSprinkles(responsiveProperties)

export const stack = style([
  sprinkles({display: 'flex', padding: {mobile: 'small', tablet: 'medium'}}),
  {
    flexDirection: 'column',
  },
])
