import {vars} from '@sanity/ui/css'
import {style} from '@vanilla-extract/css'

export const input = style({
  'cursor': 'pointer',
  'boxSizing': 'border-box',
  'background': vars.color.border,
  'border': '0 solid transparent',
  'borderRadius': '2px',
  'padding': '0',
  'appearance': 'none',
  'margin': '0',
  'height': '1.6rem',
  'overflow': 'clip',
  'width': '8ch',

  ':hover': {
    boxShadow: `0 0 0 2px ${vars.color.tinted.default.border[3]}`,
  },

  'selectors': {
    '&::-webkit-color-swatch-wrapper': {
      padding: '0',
    },
    '&::-webkit-color-swatch': {
      'padding': '0',
      'border': '0 solid transparent',
      'borderRadius': '2px',
      'boxShadow': `inset 0 0 0 1px ${vars.color.fg}`,
      '@supports': {
        '(color: rgb(from white r g b / 20%))': {
          boxShadow: `inset 0 0 0 1px rgb(from ${vars.color.fg} r g b / 20%)`,
        },
      },
    },
    '&::-moz-color-swatch': {
      'padding': '0',
      'border': '0 solid transparent',
      'borderRadius': '2px',
      'boxShadow': `inset 0 0 0 1px ${vars.color.fg}`,
      '@supports': {
        '(color: rgb(from white r g b / 20%))': {
          boxShadow: `inset 0 0 0 1px rgb(from ${vars.color.fg} r g b / 20%)`,
        },
      },
    },
  },
})
