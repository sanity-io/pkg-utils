import {fallbackVar} from '@vanilla-extract/css'
import {assignInlineVars} from '@vanilla-extract/dynamic'
import {describe, expect, test} from 'vitest'
import {assignVars, getVarName, type Contract, type MapLeafNodes} from '../src/index.ts'
import {avatarSize, brandColor, escapedVar, textColor, themeVars} from './fixtures/avatar.css.ts'

describe('assignVars', () => {
  describe('with variables', () => {
    test('keys the declarations by custom property name', () => {
      expect(assignVars({[brandColor]: 'pink', [avatarSize]: '2rem'})).toEqual({
        [getVarName(brandColor)]: 'pink',
        [getVarName(avatarSize)]: '2rem',
      })
    })

    test('omits null and undefined values', () => {
      expect(
        assignVars({[brandColor]: 'pink', [textColor]: null, [avatarSize]: undefined}),
      ).toEqual({[getVarName(brandColor)]: 'pink'})
      expect(Object.keys(assignVars({[textColor]: null}))).toEqual([])
    })

    test('accepts fallbackVar() references, escaped names and hand-written names as keys', () => {
      expect(
        assignVars({
          [fallbackVar(avatarSize, '1rem')]: '2rem',
          [escapedVar]: '3rem',
          '--avatar-size': '4rem',
          'var(--legacy-size)': '5rem',
        }),
      ).toEqual({
        [getVarName(avatarSize)]: '2rem',
        [getVarName(escapedVar)]: '3rem',
        '--avatar-size': '4rem',
        '--legacy-size': '5rem',
      })
    })

    test('produces the same declarations as @vanilla-extract/dynamic assigns inline', () => {
      const vars = {[brandColor]: 'pink', [textColor]: null, [avatarSize]: '2rem'}

      expect({...assignVars(vars)}).toEqual({...assignInlineVars(vars)})
    })

    test('rejects keys that are not variables', () => {
      expect(() => assignVars({['avatarSize' as `--${string}`]: '2rem'})).toThrowError(
        'received "avatarSize"',
      )
    })

    test('rejects values that would stringify to garbage, but stringifies numbers', () => {
      expect(() => assignVars({[brandColor]: false as unknown as string})).toThrowError(
        `Expected a string value for ${brandColor}, received boolean`,
      )
      expect(() => assignVars({[brandColor]: {} as unknown as string})).toThrowError(
        `Expected a string value for ${brandColor}, received {}`,
      )
      expect(assignVars({[avatarSize]: 2 as unknown as string})).toEqual({
        [getVarName(avatarSize)]: '2',
      })
    })
  })

  describe('with a theme contract', () => {
    test('assigns every variable of the contract from the same-shaped tokens', () => {
      expect(
        assignVars(themeVars, {
          color: {brand: 'pink', text: 'black'},
          font: {body: 'Inter, sans-serif'},
        }),
      ).toEqual({
        [getVarName(themeVars.color.brand)]: 'pink',
        [getVarName(themeVars.color.text)]: 'black',
        [getVarName(themeVars.font.body)]: 'Inter, sans-serif',
      })
    })

    test('produces the same declarations as @vanilla-extract/dynamic assigns inline', () => {
      const tokens = {color: {brand: 'pink', text: 'black'}, font: {body: 'serif'}}

      expect({...assignVars(themeVars, tokens)}).toEqual({...assignInlineVars(themeVars, tokens)})
    })

    test('omits null and undefined tokens at runtime', () => {
      const tokens = {color: {brand: 'pink', text: null}, font: {body: undefined}}

      expect(
        assignVars(themeVars, tokens as unknown as MapLeafNodes<typeof themeVars, string>),
      ).toEqual({[getVarName(themeVars.color.brand)]: 'pink'})
    })

    test('rejects tokens that are not in the contract', () => {
      const tokens = {color: {brand: 'pink', text: 'black', accent: 'blue'}, font: {body: 'serif'}}

      expect(() =>
        assignVars(themeVars, tokens as MapLeafNodes<typeof themeVars, string>),
      ).toThrowError('Path color -> accent does not exist in the theme contract')
    })

    test('rejects tokens whose shape differs from the contract', () => {
      const flat = {color: 'pink', font: {body: 'serif'}}
      const nested = {color: {brand: 'pink', text: 'black'}, font: {body: {weight: '400'}}}

      expect(() =>
        assignVars(themeVars, flat as unknown as MapLeafNodes<typeof themeVars, string>),
      ).toThrowError('Expected a CSS variable at color in the theme contract')
      expect(() =>
        assignVars(themeVars, nested as unknown as MapLeafNodes<typeof themeVars, string>),
      ).toThrowError('Expected a nested theme contract at font -> body')
    })

    test('rejects a contract that still has unassigned (null) leaves', () => {
      const contract = {color: {brand: null}} satisfies Contract

      expect(() => assignVars(contract, {color: {brand: 'pink'}})).toThrowError(
        'Expected a CSS variable at color -> brand in the theme contract, received null',
      )
    })
  })

  describe('toString()', () => {
    test('renders the declarations as CSS text, each terminated by a semicolon', () => {
      const declarations = assignVars({[brandColor]: 'pink', [avatarSize]: '2rem'})

      expect(String(declarations)).toBe(
        `${getVarName(brandColor)}: pink;${getVarName(avatarSize)}: 2rem;`,
      )
      expect(`${declarations}color: red;`).toBe(
        `${getVarName(brandColor)}: pink;${getVarName(avatarSize)}: 2rem;color: red;`,
      )
      expect(String(assignVars({[textColor]: null}))).toBe('')
    })

    test('is not an own enumerable property, so spreading and iterating only see declarations', () => {
      const declarations = assignVars({[brandColor]: 'pink'})

      expect(Object.keys(declarations)).toEqual([getVarName(brandColor)])
      expect({...declarations}).toEqual({[getVarName(brandColor)]: 'pink'})
      expect(JSON.stringify(declarations)).toBe(`{"${getVarName(brandColor)}":"pink"}`)
      expect(Object.prototype.propertyIsEnumerable.call(declarations, 'toString')).toBe(false)
    })
  })
})
