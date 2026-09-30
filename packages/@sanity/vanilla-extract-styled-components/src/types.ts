/**
 * A CSS variable reference as returned by the vanilla-extract APIs (`createVar`,
 * `createThemeContract`, `createTheme`, `createGlobalVar`, `fallbackVar`): the `var()` function
 * wrapping the custom property name, e.g. `var(--brandColor__8uideo0)`.
 *
 * Reading the variable in a styled-components style needs no help — the reference is a valid CSS
 * value as-is (`color: ${brandColor};`). Setting it does, since the declaration needs the bare
 * {@link CSSVarName | property name}: use {@link getVarName} or {@link assignVars}.
 * @public
 */
export type CSSVarFunction = `var(--${string})`

/**
 * The name of a CSS custom property, e.g. `--brandColor__8uideo0`: the left-hand side of the
 * declaration that assigns a variable, as extracted from a {@link CSSVarFunction} by
 * {@link getVarName}.
 * @public
 */
export type CSSVarName = `--${string}`

/**
 * A vanilla-extract theme contract: a (nested) object whose leaves are CSS variable references,
 * as returned by `createThemeContract`, `createGlobalThemeContract` or `createTheme`.
 * @public
 */
export type Contract = {
  [key: string]: CSSVarFunction | null | Contract
}

type Primitive = string | boolean | number | null | undefined

/**
 * Maps every leaf of a (nested) object type to `LeafType`, keeping the shape — the type of the
 * `tokens` argument of {@link assignVars} when a {@link Contract} is passed: the same shape with a
 * string value for every variable.
 * @public
 */
export type MapLeafNodes<Obj, LeafType> = {
  [Prop in keyof Obj]: Obj[Prop] extends Primitive
    ? LeafType
    : // `any` (not `unknown`) on purpose: a string index signature of `any` is what lets interface
      // types, which have no implicit index signature, count as nested contracts
      Obj[Prop] extends Record<string | number, any>
      ? MapLeafNodes<Obj[Prop], LeafType>
      : never
}

/**
 * The custom property declarations that assign vanilla-extract variables, keyed by
 * {@link CSSVarName | property name}: what {@link assignVars} returns.
 *
 * It is a plain object, so styled-components (and any other CSS-in-JS library that accepts custom
 * properties in object styles) can take it as an object style, spread it into one, or interpolate
 * it into a `css`/`styled` template literal. Its `toString()` renders the declarations as CSS text
 * (`--brandColor__8uideo0: pink;`), so it also works in plain template strings.
 * @public
 */
export type VarDeclarations = {
  [name: CSSVarName]: string
  /** The declarations as CSS text, each terminated by a semicolon */
  toString(): string
}
