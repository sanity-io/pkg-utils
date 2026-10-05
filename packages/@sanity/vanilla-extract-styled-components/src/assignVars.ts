import {toVarName} from './getVarName.ts'
import type {Contract, CSSVarFunction, CSSVarName, MapLeafNodes, VarDeclarations} from './types.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function describePath(path: string[]): string {
  return path.join(' -> ')
}

/**
 * Values reach here as `string` from TypeScript, but from JavaScript anything can be passed, and
 * `String(false)` or `String({})` would emit garbage declarations without a hint of what went
 * wrong.
 */
function toValue(value: unknown, path: string[]): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)

  throw new TypeError(
    `Expected a string value for ${describePath(path)}, received ${typeof value === 'object' ? JSON.stringify(value) : typeof value}`,
  )
}

function assignVariables(vars: Record<string, unknown>, declarations: VarDeclarations): void {
  for (const variable of Object.keys(vars)) {
    const value = vars[variable]

    if (value == null) continue
    declarations[toVarName(variable)] = toValue(value, [variable])
  }
}

function assignContractTokens(
  contract: Record<string, unknown>,
  tokens: Record<string, unknown>,
  path: string[],
  declarations: VarDeclarations,
): void {
  for (const key of Object.keys(tokens)) {
    const value = tokens[key]
    const currentPath = [...path, key]

    if (value == null) continue
    if (!Object.hasOwn(contract, key)) {
      throw new Error(`Path ${describePath(currentPath)} does not exist in the theme contract`)
    }

    const variable = contract[key]

    if (isRecord(value)) {
      if (!isRecord(variable)) {
        throw new TypeError(
          `Expected a nested theme contract at ${describePath(currentPath)}, received ${JSON.stringify(variable)}`,
        )
      }
      assignContractTokens(variable, value, currentPath, declarations)
    } else {
      if (typeof variable !== 'string') {
        throw new TypeError(
          `Expected a CSS variable at ${describePath(currentPath)} in the theme contract, received ${JSON.stringify(variable)}`,
        )
      }
      declarations[toVarName(variable)] = toValue(value, currentPath)
    }
  }
}

/**
 * Renders the declarations as CSS text, each terminated by `;` so consecutive interpolations
 * (`${assignVars(a)}${assignVars(b)}color: red;`) stay well-formed. styled-components prefers
 * this over walking the object when an interpolated plain object defines its own `toString`.
 */
function declarationsToString(this: Record<string, string>): string {
  return Object.keys(this)
    .map((name) => `${name}: ${this[name]};`)
    .join('')
}

/**
 * Assigns vanilla-extract variables from a styled-components style: the
 * `@vanilla-extract/dynamic` `assignInlineVars` counterpart for `css`/`styled` template literals
 * and object styles instead of the inline `style` attribute.
 *
 * The vanilla-extract APIs produce variable references that contain the CSS `var()` function,
 * e.g. `var(--brandColor__8uideo0)`, so the wrapping function has to be removed to set the
 * variable — this does that for every key and returns the resulting custom property declarations
 * as a plain object (`{'--brandColor__8uideo0': 'pink'}`) that styled-components accepts as an
 * object style, spread into one, or interpolated into a template literal. Its `toString()`
 * renders the same declarations as CSS text (`--brandColor__8uideo0: pink;`), so plain template
 * strings work too.
 *
 * Variables with a value of `null` or `undefined` are omitted.
 *
 * @example
 * ```ts
 * const Section = styled.section<{$tone?: 'critical'}>`
 *   ${({$tone}) =>
 *     assignVars({
 *       [brandColor]: 'pink',
 *       [textColor]: $tone === 'critical' ? 'red' : null,
 *     })}
 * `
 * ```
 * @public
 */
export function assignVars(
  vars: Record<CSSVarFunction | CSSVarName, string | null | undefined>,
): VarDeclarations
/**
 * Assigns every variable of a vanilla-extract theme contract (`createThemeContract`,
 * `createGlobalThemeContract`, the vars of `createTheme`) from a styled-components style. All
 * variables must be assigned or it's a type error.
 *
 * @example
 * ```ts
 * const Theme = createGlobalStyle<{$brand: string; $font: string}>`
 *   :root {
 *     ${({$brand, $font}) =>
 *       assignVars(themeVars, {
 *         color: {brand: $brand},
 *         font: {body: $font},
 *       })}
 *   }
 * `
 * ```
 * @public
 */
export function assignVars<ThemeContract extends Contract>(
  contract: ThemeContract,
  tokens: MapLeafNodes<ThemeContract, string>,
): VarDeclarations
export function assignVars(
  varsOrContract: Record<string, unknown>,
  tokens?: Record<string, unknown>,
): VarDeclarations {
  const declarations: VarDeclarations = {}

  if (tokens === undefined) {
    assignVariables(varsOrContract, declarations)
  } else {
    assignContractTokens(varsOrContract, tokens, [], declarations)
  }

  Object.defineProperty(declarations, 'toString', {value: declarationsToString})

  return declarations
}
