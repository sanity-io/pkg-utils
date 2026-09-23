/**
 * The CSS object model that `@vanilla-extract/css` hands to an {@link Adapter}. Upstream keeps
 * these block types internal (`packages/css/src/types.ts`), so they're derived here from the
 * `Adapter` signature it does export, plus the few structural style types the renderer needs.
 */
import type {Adapter, CSSProperties, GlobalStyleRule, StyleRule} from '@vanilla-extract/css'
import type {SimplePseudos} from './simplePseudos.ts'

/** Every kind of CSS object an adapter can receive through `appendCss`. */
export type CSS = Parameters<Adapter['appendCss']>[0]

/** A registered class list composition (`style([a, b])`). */
export type Composition = Parameters<Adapter['registerComposition']>[0]

export type CSSStyleBlock = Extract<CSS, {type: 'local'}>
export type CSSSelectorBlock = Extract<CSS, {type: 'selector' | 'global'}>
export type CSSKeyframesBlock = Extract<CSS, {type: 'keyframes'}>
export type CSSPropertyBlock = Extract<CSS, {type: 'property'}>
export type CSSFontFaceBlock = Extract<CSS, {type: 'fontFace'}>
export type CSSLayerDeclaration = Extract<CSS, {type: 'layer'}>
export type GlobalFontFaceRule = CSSFontFaceBlock['rule']

export type CSSPropertiesWithVars = CSSProperties & {
  vars?: {[key: string]: string}
}

type PseudoProperties = {
  [key in SimplePseudos]?: CSSPropertiesWithVars
}

export type CSSPropertiesAndPseudos = CSSPropertiesWithVars & PseudoProperties

export interface SelectorMap {
  [selector: string]: GlobalStyleRule
}

/** A style block without its at-rule queries: plain declarations, simple pseudos, selectors. */
export interface StyleWithSelectors extends CSSPropertiesAndPseudos {
  selectors?: SelectorMap
}

export type {GlobalStyleRule, StyleRule}
