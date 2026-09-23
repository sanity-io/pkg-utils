import {
  createGlobalTheme,
  createTheme,
  createThemeContract,
  createVar,
  fontFace,
  globalFontFace,
  globalKeyframes,
  globalLayer,
  keyframes,
  layer,
} from '@vanilla-extract/css'

export const vars = createThemeContract({
  color: {
    brand: null,
    accent: null,
  },
  space: {
    small: null,
    medium: null,
  },
})

export const lightTheme = createTheme(vars, {
  color: {brand: 'rgb(1, 2, 3)', accent: 'rgb(4, 5, 6)'},
  space: {small: '4px', medium: '8px'},
})

export const [darkTheme, darkVars] = createTheme({
  color: {brand: 'rgb(31, 32, 33)', accent: 'rgb(34, 35, 36)'},
  space: {small: '5px', medium: '9px'},
})

createGlobalTheme(':root', vars, {
  color: {brand: 'rgb(7, 8, 9)', accent: 'rgb(10, 11, 12)'},
  space: {small: '2px', medium: '6px'},
})

export const typedVar = createVar({
  syntax: '<length>',
  inherits: false,
  initialValue: '0px',
})

export const plainVar = createVar()

export const baseLayer = layer('base')
export const componentLayer = layer({parent: baseLayer}, 'components')
export const resetLayer = globalLayer('reset')

export const fadeIn = keyframes({
  from: {opacity: 0, transform: 'translateY(4px)'},
  to: {opacity: 1, transform: 'translateY(0)'},
})

globalKeyframes('spin', {
  '0%': {transform: 'rotate(0deg)'},
  '100%': {transform: 'rotate(360deg)'},
})

export const displayFont = fontFace([
  {src: 'local("Comic Sans MS")', fontWeight: 400},
  {src: 'local("Comic Sans MS Bold")', fontWeight: 700},
])

globalFontFace('GlobalDisplay', {src: 'local("Inter")', fontDisplay: 'swap'})
