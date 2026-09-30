/**
 * Assign vanilla-extract CSS variables from styled-components styles.
 *
 * The runtime counterpart of `@vanilla-extract/dynamic` (MIT licensed, Copyright (c) 2021 SEEK)
 * for CSS-in-JS: where `assignInlineVars` targets the inline `style` attribute, {@link assignVars}
 * targets `css`/`styled` template literals and object styles, and {@link getVarName} exposes the
 * bare custom property name that setting a `createVar()` variable in a template literal needs.
 *
 * @packageDocumentation
 */

export {assignVars} from './assignVars.ts'
export {getVarName} from './getVarName.ts'
export type {Contract, CSSVarFunction, CSSVarName, MapLeafNodes, VarDeclarations} from './types.ts'
