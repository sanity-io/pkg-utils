import {style} from '@vanilla-extract/css'
import {accentColor} from './theme.ts'

export const box: string = style({
  color: accentColor,
  height: '40rem',
})
