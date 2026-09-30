import type {ReactElement} from 'react'
import {renderToString} from 'react-dom/server'
import {createGlobalStyle, css, ServerStyleSheet, styled, type CSSObject} from 'styled-components'
import {describe, expect, test} from 'vitest'
import {assignVars, getVarName} from '../src/index.ts'
import {
  avatarImage,
  avatarSize,
  brandColor,
  textColor,
  themeVars,
  vanillaCss,
} from './fixtures/avatar.css.ts'

/** Server-renders the element and returns the `<style>` tag styled-components generated for it */
function renderCss(element: ReactElement): string {
  const sheet = new ServerStyleSheet()

  try {
    renderToString(sheet.collectStyles(element))

    return sheet.getStyleTags()
  } finally {
    sheet.seal()
  }
}

const avatarSizeName = getVarName(avatarSize)
const brandColorName = getVarName(brandColor)
const textColorName = getVarName(textColor)

describe('styled-components', () => {
  test('sets the variable a vanilla-extract style reads from', () => {
    const Root = styled.div`
      ${assignVars({[avatarSize]: '2rem'})}
    `

    // The .css.ts side: the class sizes itself from the variable...
    expect(vanillaCss).toContain(`.${avatarImage} {`)
    expect(vanillaCss).toContain(`width: ${avatarSize};`)
    // ...and the styled-components side assigns that same property
    expect(renderCss(<Root className={avatarImage} />)).toContain(`{${avatarSizeName}:2rem;}`)
    expect(avatarSize).toBe(`var(${avatarSizeName})`)
  })

  test('interpolates into a template literal next to other declarations', () => {
    const Root = styled.section`
      ${assignVars({[brandColor]: 'pink', [textColor]: null})}
      color: ${textColor};
      background: ${brandColor};
    `

    expect(renderCss(<Root />)).toContain(
      `{${brandColorName}:pink;color:${textColor};background:${brandColor};}`,
    )
  })

  test('keeps consecutive interpolations apart', () => {
    const Root = styled.div`
      ${assignVars({[brandColor]: 'pink'})}${assignVars({[avatarSize]: '2rem'})}color: red;
    `

    expect(renderCss(<Root />)).toContain(
      `{${brandColorName}:pink;${avatarSizeName}:2rem;color:red;}`,
    )
  })

  test('assigns from props through a style function', () => {
    const Avatar = styled.div<{$size: number; $tone?: 'critical'}>`
      ${({$size, $tone}) =>
        assignVars({
          [avatarSize]: `${$size}px`,
          [textColor]: $tone === 'critical' ? 'red' : null,
        })}
    `

    expect(renderCss(<Avatar $size={33} />)).toContain(`{${avatarSizeName}:33px;}`)
    expect(renderCss(<Avatar $size={19} $tone="critical" />)).toContain(
      `{${avatarSizeName}:19px;${textColorName}:red;}`,
    )
  })

  test('sets a single variable through its name in a template literal', () => {
    const Avatar = styled.div<{$size: number}>`
      ${avatarSizeName}: ${({$size}) => `${$size}px`};
      width: ${avatarSize};
    `

    expect(renderCss(<Avatar $size={25} />)).toContain(
      `{${avatarSizeName}:25px;width:${avatarSize};}`,
    )
  })

  test('works with the css helper', () => {
    const sized = css<{$size: string}>`
      ${({$size}) => assignVars({[avatarSize]: $size})}
    `
    const Root = styled.div<{$size: string}>`
      ${sized}
      display: block;
    `

    expect(renderCss(<Root $size="3rem" />)).toContain(`{${avatarSizeName}:3rem;display:block;}`)
  })

  test('is an object style, and spreads into one', () => {
    const Plain = styled.div(assignVars({[brandColor]: 'pink'}))
    const Spread = styled.div<{$size: string}>(({$size}) => ({
      ...assignVars({[avatarSize]: $size}),
      width: avatarSize,
    }))

    expect(renderCss(<Plain />)).toContain(`{${brandColorName}:pink;}`)
    expect(renderCss(<Spread $size="4rem" />)).toContain(
      `{${avatarSizeName}:4rem;width:${avatarSize};}`,
    )
  })

  test('assigns per breakpoint from responsive object styles (the @sanity/ui pattern)', () => {
    const media = ['', '@media (min-width: 640px)', '@media (min-width: 960px)']
    const responsiveSize = (sizes: string[]): CSSObject[] =>
      sizes.map((size, index) => {
        const declarations = assignVars({[avatarSize]: size})
        const query = media[index]

        return query ? {[query]: declarations} : declarations
      })
    const Avatar = styled.div<{$size: string[]}>(({$size}) => responsiveSize($size))

    const output = renderCss(<Avatar $size={['1.1875rem', '2.0625rem']} />)

    expect(output).toContain(`{${avatarSizeName}:1.1875rem;}`)
    expect(output).toContain(`@media (min-width: 640px){`)
    expect(output).toContain(`{${avatarSizeName}:2.0625rem;}}`)
  })

  test('assigns a theme contract from a global style', () => {
    const Theme = createGlobalStyle<{$brand: string; $font: string}>`
      :root {
        ${({$brand, $font}) =>
          assignVars(themeVars, {
            color: {brand: $brand, text: 'black'},
            font: {body: $font},
          })}
      }
    `

    expect(renderCss(<Theme $brand="pink" $font="serif" />)).toContain(
      `:root{${getVarName(themeVars.color.brand)}:pink;${getVarName(themeVars.color.text)}:black;${getVarName(themeVars.font.body)}:serif;}`,
    )
  })
})
