import {createContainer, globalStyle, style, styleVariants} from '@vanilla-extract/css'
import {
  baseLayer,
  componentLayer,
  displayFont,
  fadeIn,
  lightTheme,
  plainVar,
  typedVar,
  vars,
} from './theme.css.ts'

export const container = createContainer()

export const base = style({
  display: 'flex',
  padding: 0,
  paddingBottom: 4,
  margin: 12,
  lineHeight: 1.5,
  zIndex: 2,
  fontFamily: displayFont,
  animationName: fadeIn,
  color: vars.color.brand,
  vars: {
    [plainVar]: '1px',
    [typedVar]: '2px',
  },
  content: 'hello',
})

export const card = style({
  'padding': [vars.space.small, 'env(safe-area-inset-top)'],
  'containerType': 'inline-size',
  'containerName': container,
  ':hover': {
    color: vars.color.accent,
  },
  '::before': {
    content: '""',
    display: 'block',
  },
  'selectors': {
    '&&': {
      backgroundColor: 'rgb(13, 14, 15)',
    },
    [`${lightTheme} &`]: {
      color: 'rgb(16, 17, 18)',
    },
    '& + &': {
      marginTop: 8,
    },
    '&:not(:last-child)': {
      'marginBottom': 8,
      '@media': {
        '(min-width: 640px)': {
          marginBottom: 16,
        },
      },
    },
  },
  '@media': {
    'screen and (min-width: 640px)': {
      'padding': 16,
      ':hover': {
        padding: 20,
      },
      'selectors': {
        '&:focus-visible': {
          outline: '2px solid currentcolor',
        },
      },
      '@supports': {
        '(display: grid)': {
          display: 'grid',
        },
      },
    },
    'screen and (min-width: 1024px)': {
      padding: 24,
    },
  },
  '@supports': {
    '(container-type: inline-size)': {
      'containerType': 'inline-size',
      '@container': {
        [`${container} (min-width: 400px)`]: {
          padding: 32,
        },
      },
    },
  },
  '@layer': {
    [baseLayer]: {
      borderRadius: 4,
    },
    [componentLayer]: {
      'borderRadius': 8,
      '@media': {
        'screen and (min-width: 640px)': {
          borderRadius: 12,
        },
      },
    },
  },
  '@scope': {
    [`${lightTheme}`]: {
      opacity: 0.9,
    },
  },
  '@starting-style': {
    'opacity': 0,
    ':hover': {
      opacity: 0.5,
    },
  },
})

// Reversed media query order compared to `card`, so the conditional ruleset deopts into a
// second ruleset (incompatible precedence).
export const reversedMedia = style({
  '@media': {
    'screen and (min-width: 1024px)': {
      margin: 24,
    },
    'screen and (min-width: 640px)': {
      margin: 16,
    },
  },
})

export const composed = style([base, {backgroundColor: 'rgb(19, 20, 21)'}])

export const pureComposition = style([base, card])

export const referencesComposition = style({
  selectors: {
    [`${pureComposition} &`]: {
      color: 'rgb(22, 23, 24)',
    },
  },
})

export const unusedPureComposition = style([base, reversedMedia])

export const tone = styleVariants({
  neutral: {color: 'rgb(25, 26, 27)'},
  critical: [base, {color: 'rgb(28, 29, 30)'}],
})

export const size = styleVariants({small: 4, large: 8}, (padding) => ({
  padding,
  '@media': {
    'screen and (min-width: 640px)': {padding: padding * 2},
  },
}))

globalStyle(`${card} svg`, {
  fill: 'currentcolor',
  vars: {[plainVar]: '3px'},
})

globalStyle('html, body', {
  'margin': 0,
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      scrollBehavior: 'auto',
    },
  },
})
