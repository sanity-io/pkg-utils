import type {CSSVarFunction, CSSVarName} from './types.ts'

/**
 * `var(` + the custom property name + either `)` or the `,` that starts a fallback (as in the
 * output of `fallbackVar`). Names may contain `cssesc` escapes such as `\:`, so an escaped
 * character is consumed as a unit instead of terminating the name.
 */
const VAR_FUNCTION = /^var\(\s*(--(?:\\.|[^\s,)\\])+)\s*(?:,|\)\s*$)/

/** A custom property name: `--` followed by at least one character (`--` alone is reserved). */
const isVarName = (value: string): value is CSSVarName => /^--./.test(value)

/**
 * The untyped core of {@link getVarName}, for keys that reach {@link assignVars} as plain strings
 */
export function toVarName(variable: string): CSSVarName {
  const name = VAR_FUNCTION.exec(variable)?.[1]

  if (name !== undefined && isVarName(name)) return name
  if (isVarName(variable)) return variable

  throw new TypeError(
    `Expected a CSS variable reference like "var(--name)" or a custom property name like "--name", received ${JSON.stringify(variable)}`,
  )
}

/**
 * Extracts the custom property name from a vanilla-extract variable reference, so the variable
 * can be assigned in a styled-components style: `createVar()` returns `var(--brandColor__8uideo0)`,
 * and setting it needs the bare `--brandColor__8uideo0`.
 *
 * Accepts the output of `createVar`, `createGlobalVar`, theme contract leaves, and `fallbackVar`
 * (`var(--name, fallback)` yields `--name`: the fallback is only meaningful when reading). A bare
 * name (`--name`) is returned as-is. Anything else throws, since silently emitting
 * `brandColor: pink;` would be a hard-to-spot bug.
 *
 * @example
 * ```ts
 * const Root = styled.div<{$size: number}>`
 *   ${getVarName(avatarSize)}: ${({$size}) => `${$size}px`};
 * `
 * ```
 * @public
 */
export function getVarName(variable: CSSVarFunction | CSSVarName): CSSVarName {
  return toVarName(variable)
}
