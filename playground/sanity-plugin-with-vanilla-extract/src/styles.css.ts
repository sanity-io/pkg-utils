import {style} from '@vanilla-extract/css'

export const input = style({
  'cursor': 'pointer',
  'boxSizing': 'border-box',
  'background': 'var(--card-border-color)',
  'border': '0 solid transparent',
  'borderRadius': '2px',
  'padding': '0',
  'appearance': 'none',
  'margin': '0',
  'height': '1.6rem',
  'overflow': 'clip',
  'width': '8ch',

  ':hover': {
    boxShadow: '0 0 0 2px var(--card-focus-ring-color)',
  },

  'selectors': {
    '&::-webkit-color-swatch-wrapper': {
      padding: '0',
    },
    '&::-webkit-color-swatch': {
      'padding': '0',
      'border': '0 solid transparent',
      'borderRadius': '2px',
      'boxShadow': 'inset 0 0 0 1px var(--card-fg-color)',
      '@supports': {
        '(color: rgb(from white r g b / 20%))': {
          boxShadow: 'inset 0 0 0 1px rgb(from var(--card-fg-color) r g b / 20%)',
        },
      },
    },
    '&::-moz-color-swatch': {
      'padding': '0',
      'border': '0 solid transparent',
      'borderRadius': '2px',
      'boxShadow': 'inset 0 0 0 1px var(--card-fg-color)',
      '@supports': {
        '(color: rgb(from white r g b / 20%))': {
          boxShadow: 'inset 0 0 0 1px rgb(from var(--card-fg-color) r g b / 20%)',
        },
      },
    },
  },
})
