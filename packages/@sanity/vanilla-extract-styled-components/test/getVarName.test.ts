import {fallbackVar} from '@vanilla-extract/css'
import {describe, expect, test} from 'vitest'
import {getVarName, type CSSVarFunction, type CSSVarName} from '../src/index.ts'
import {
  avatarSize,
  brandColor,
  escapedVar,
  hexEscapedVar,
  themeVars,
} from './fixtures/avatar.css.ts'

describe('getVarName', () => {
  test('unwraps the var() function around a createVar() reference', () => {
    expect(avatarSize).toMatch(/^var\(--avatarSize__\w+\)$/)
    expect(getVarName(avatarSize)).toBe(avatarSize.slice('var('.length, -')'.length))
    expect(getVarName(avatarSize)).toMatch(/^--avatarSize__\w+$/)
  })

  test('round-trips: wrapping the name in var() gives the reference back', () => {
    for (const variable of [avatarSize, brandColor, themeVars.color.brand, themeVars.font.body]) {
      expect(`var(${getVarName(variable)})`).toBe(variable)
    }
  })

  test('keeps cssesc escapes in the name intact', () => {
    expect(escapedVar).toMatch(/^var\(--avatar\\:size__\w+\)$/)
    expect(getVarName(escapedVar)).toBe(escapedVar.slice('var('.length, -')'.length))
  })

  test('keeps the space that terminates a cssesc hex escape inside the name', () => {
    expect(hexEscapedVar).toMatch(/^var\(--h\\E9 ader__\w+\)$/)
    expect(getVarName(hexEscapedVar)).toBe(hexEscapedVar.slice('var('.length, -')'.length))
    expect(getVarName(fallbackVar(hexEscapedVar, '2rem'))).toBe(getVarName(hexEscapedVar))
  })

  test('drops the fallback of a fallbackVar() reference, which only matters when reading', () => {
    expect(getVarName(fallbackVar(avatarSize, '2rem'))).toBe(getVarName(avatarSize))
    expect(getVarName(fallbackVar(avatarSize, brandColor))).toBe(getVarName(avatarSize))
    expect(getVarName(fallbackVar(avatarSize, brandColor, 'calc(1rem + 2px)'))).toBe(
      getVarName(avatarSize),
    )
  })

  test('accepts hand-written names and references', () => {
    expect(getVarName('--avatar-size')).toBe('--avatar-size')
    expect(getVarName('var(--avatar-size)')).toBe('--avatar-size')
    expect(getVarName('var( --avatar-size )' as CSSVarFunction)).toBe('--avatar-size')
    expect(getVarName('var(--avatar-size, 2rem)')).toBe('--avatar-size')
    expect(getVarName('var(--avatar-size,2rem)')).toBe('--avatar-size')
  })

  test('throws for anything that is not a variable, instead of emitting a broken declaration', () => {
    for (const invalid of ['avatarSize', '', '--', 'var()', 'var(avatarSize)', 'var(--x) y']) {
      expect(() => getVarName(invalid as CSSVarFunction)).toThrowError(
        new TypeError(
          `Expected a CSS variable reference like "var(--name)" or a custom property name like "--name", received ${JSON.stringify(invalid)}`,
        ),
      )
    }
  })

  test('is typed as the custom property name', () => {
    const name: CSSVarName = getVarName(avatarSize)

    expect(name.startsWith('--')).toBe(true)
  })
})
