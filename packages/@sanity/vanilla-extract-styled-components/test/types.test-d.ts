import type {CSSObject, Interpolation, RuleSet} from 'styled-components'
import {describe, expectTypeOf, test} from 'vitest'
import {
  assignVars,
  getVarName,
  type Contract,
  type CSSVarFunction,
  type CSSVarName,
  type MapLeafNodes,
  type VarDeclarations,
} from '../src/index.ts'
import {avatarSize, brandColor, themeVars} from './fixtures/avatar.css.ts'

describe('types', () => {
  test('getVarName narrows a variable reference to its property name', () => {
    expectTypeOf(avatarSize).toEqualTypeOf<CSSVarFunction>()
    expectTypeOf(getVarName(avatarSize)).toEqualTypeOf<CSSVarName>()
    expectTypeOf(getVarName('--avatar-size')).toEqualTypeOf<CSSVarName>()
    expectTypeOf(getVarName).parameter(0).toEqualTypeOf<CSSVarFunction | CSSVarName>()
  })

  test('assignVars only accepts variable references and property names as keys', () => {
    expectTypeOf(
      assignVars({[avatarSize]: '2rem', [brandColor]: null}),
    ).toEqualTypeOf<VarDeclarations>()
    expectTypeOf(assignVars({'--avatar-size': '2rem'})).toEqualTypeOf<VarDeclarations>()
    // Variables that lost their template literal type along the way are validated at runtime
    expectTypeOf(assignVars({[avatarSize as string]: '2rem'})).toEqualTypeOf<VarDeclarations>()
    // @ts-expect-error a bare word is neither a variable reference nor a property name
    assignVars({avatarSize: '2rem'})
    // @ts-expect-error values are strings (or null/undefined to skip)
    assignVars({[avatarSize]: 2})
  })

  test('assignVars requires every variable of a theme contract to be assigned', () => {
    type Tokens = MapLeafNodes<typeof themeVars, string>

    expectTypeOf<Tokens>().toEqualTypeOf<{
      color: {brand: string; text: string}
      font: {body: string}
    }>()
    expectTypeOf(themeVars).toMatchTypeOf<Contract>()
    expectTypeOf(
      assignVars(themeVars, {color: {brand: 'pink', text: 'black'}, font: {body: 'serif'}}),
    ).toEqualTypeOf<VarDeclarations>()
    // @ts-expect-error `font.body` is missing
    assignVars(themeVars, {color: {brand: 'pink', text: 'black'}})
    assignVars(themeVars, {
      color: {
        brand: 'pink',
        text: 'black',
        // @ts-expect-error `accent` is not in the contract
        accent: 'blue',
      },
      font: {body: 'serif'},
    })
    // Unassigned (null) contract leaves still map to string tokens, like upstream: the runtime
    // check in assignVars is what rejects such a contract
    expectTypeOf<MapLeafNodes<{color: null}, string>>().toEqualTypeOf<{color: string}>()
  })

  test('the declarations are a styled-components object style and interpolation', () => {
    const declarations = assignVars({[avatarSize]: '2rem'})

    expectTypeOf(declarations).toMatchTypeOf<CSSObject>()
    expectTypeOf(declarations).toMatchTypeOf<Interpolation<object>>()
    expectTypeOf(declarations).toMatchTypeOf<Interpolation<{$size: number}>>()
    expectTypeOf({...declarations, width: avatarSize}).toMatchTypeOf<CSSObject>()
    expectTypeOf({'@media (min-width: 640px)': declarations}).toMatchTypeOf<CSSObject>()
    expectTypeOf([declarations, {width: avatarSize}]).toMatchTypeOf<RuleSet<object>>()
    expectTypeOf(declarations.toString()).toEqualTypeOf<string>()
  })
})
