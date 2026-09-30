/**
 * The `.css.ts` module of the tests: real vanilla-extract variables, theme contract and styles,
 * evaluated without a build plugin by setting the file scope and a collecting adapter by hand
 * (what the plugins inject). `vanillaCss` is the stylesheet vanilla-extract extracts from it.
 */
import {createThemeContract, createVar, style, type Adapter} from '@vanilla-extract/css'
import {removeAdapter, setAdapter} from '@vanilla-extract/css/adapter'
import {endFileScope, setFileScope} from '@vanilla-extract/css/fileScope'
import {transformCss} from '@vanilla-extract/css/transformCss'

const cssObjs: Parameters<Adapter['appendCss']>[0][] = []
const localClassNames: string[] = []

const adapter: Adapter = {
  appendCss: (css) => {
    cssObjs.push(css)
  },
  registerClassName: (className) => {
    localClassNames.push(className)
  },
  registerComposition: () => {},
  markCompositionUsed: () => {},
  onEndFileScope: () => {},
  getIdentOption: () => 'debug',
}

setAdapter(adapter)
setFileScope('test/fixtures/avatar.css.ts', '@sanity/vanilla-extract-styled-components')

export const avatarSize = createVar('avatarSize')
export const brandColor = createVar('brandColor')
export const textColor = createVar('textColor')
/** The debug id is escaped by `cssesc`, so the property name contains a `\:` escape */
export const escapedVar = createVar('avatar:size')
/**
 * `cssesc` escapes the `é` as a hex escape, and keeps the space that terminates it because the
 * next character is a hex digit, so the property name contains a `\E9 ` escape
 */
export const hexEscapedVar = createVar('héader')

export const themeVars = createThemeContract({
  color: {brand: null, text: null},
  font: {body: null},
})

export const avatarImage = style({
  width: avatarSize,
  height: avatarSize,
  borderRadius: '50%',
})

endFileScope()

export const vanillaCss = transformCss({localClassNames, composedClassLists: [], cssObjs}).join(
  '\n',
)

removeAdapter()
