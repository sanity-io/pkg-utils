/**
 * Ported from `@vanilla-extract/css` (MIT licensed, Copyright (c) 2021 SEEK):
 * `packages/css/src/transformCss.ts` — the renderer that turns the CSS objects collected by an
 * adapter into CSS text. Vendored so the fork owns the one place that knows the final rule order
 * (unconditional rules first, then the precedence-sorted conditional rulesets), which the atomic
 * pass builds on. With the default options the output is byte-identical to upstream's
 * `transformCss` (see `test/transformCss.test.ts`).
 *
 * Differences from upstream: `getVarName` is inlined instead of imported from
 * `@vanilla-extract/private`, `dedent` is replaced by plain strings, and the composition-usage
 * callback is injectable (defaulting to the `@vanilla-extract/css/adapter` global, like upstream).
 */
import {markCompositionUsed} from '@vanilla-extract/css/adapter'
import AhoCorasick from 'modern-ahocorasick'
import {ConditionalRuleset} from './conditionalRulesets.ts'
import {cssesc} from './cssesc.ts'
import {nestingSelectorRegex} from './nestingSelectorRegex.ts'
import {simplePseudoLookup, simplePseudos} from './simplePseudos.ts'
import type {
  Composition,
  CSS,
  CSSKeyframesBlock,
  CSSPropertyBlock,
  CSSSelectorBlock,
  CSSStyleBlock,
  GlobalFontFaceRule,
  StyleRule,
  StyleWithSelectors,
} from './types.ts'
import {dashify, escapeRegex, forEach, getVarName, mapKeys, omit, toRecord} from './utils.ts'
import {validateMediaQuery} from './validateMediaQuery.ts'
import {validateSelector} from './validateSelector.ts'

const DECLARATION = '__DECLARATION'

const UNITLESS: Record<string, boolean> = {
  animationIterationCount: true,
  borderImage: true,
  borderImageOutset: true,
  borderImageSlice: true,
  borderImageWidth: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  columns: true,
  flex: true,
  flexGrow: true,
  flexShrink: true,
  fontWeight: true,
  gridArea: true,
  gridColumn: true,
  gridColumnEnd: true,
  gridColumnStart: true,
  gridRow: true,
  gridRowEnd: true,
  gridRowStart: true,
  initialLetter: true,
  lineClamp: true,
  lineHeight: true,
  maxLines: true,
  opacity: true,
  order: true,
  orphans: true,
  scale: true,
  tabSize: true,
  WebkitLineClamp: true,
  widows: true,
  zIndex: true,
  zoom: true,

  // svg properties
  fillOpacity: true,
  floodOpacity: true,
  maskBorder: true,
  maskBorderOutset: true,
  maskBorderSlice: true,
  maskBorderWidth: true,
  shapeImageThreshold: true,
  stopOpacity: true,
  strokeDashoffset: true,
  strokeMiterlimit: true,
  strokeOpacity: true,
  strokeWidth: true,
}

function replaceBetweenIndexes(
  target: string,
  startIndex: number,
  endIndex: number,
  replacement: string,
): string {
  const start = target.slice(0, startIndex)
  const end = target.slice(endIndex)

  return `${start}${replacement}${end}`
}

const DOUBLE_SPACE = '  '

const specialKeys: ReadonlyArray<string> = [
  ...simplePseudos,
  '@layer',
  '@scope',
  '@media',
  '@supports',
  '@container',
  '@starting-style',
  'selectors',
]

/** A rendered declaration block: the transformed selector and its (pixelified, var-mapped) rule. */
export interface CSSRule {
  conditions?: Array<string>
  selector: string
  rule: Record<string, unknown>
}

/** The branches of one at-rule kind on a style block, e.g. `StyleRule['@media']`. */
type QueryRules<Key extends keyof StyleRule> = StyleRule[Key]

/** Options shared by {@link Stylesheet} and {@link transformCss}. */
export interface StylesheetOptions {
  /**
   * Called when a selector references a class list composition, so the caller can keep its
   * identifier class in the serialized exports. Defaults to `markCompositionUsed` of
   * `@vanilla-extract/css/adapter`, i.e. whatever adapter is currently set — the upstream
   * behavior.
   */
  onCompositionUsed?: (identifier: string) => void
}

export class Stylesheet {
  rules: Array<CSSRule>
  conditionalRulesets: Array<ConditionalRuleset>
  currConditionalRuleset: ConditionalRuleset | undefined
  fontFaceRules: Array<GlobalFontFaceRule>
  keyframesRules: Array<CSSKeyframesBlock>
  localClassNamesMap: Map<string, string>
  localClassNamesSearch: AhoCorasick
  composedClassLists: Array<{identifier: string; regex: RegExp}>
  layers: Map<string, Array<string>>
  propertyRules: Array<CSSPropertyBlock>
  readonly onCompositionUsed: (identifier: string) => void

  constructor(
    localClassNames: Array<string>,
    composedClassLists: Array<Composition>,
    options: StylesheetOptions = {},
  ) {
    this.rules = []
    this.conditionalRulesets = [new ConditionalRuleset()]
    this.fontFaceRules = []
    this.keyframesRules = []
    this.propertyRules = []
    this.localClassNamesMap = new Map(
      localClassNames.map((localClassName) => [localClassName, localClassName]),
    )
    this.localClassNamesSearch = new AhoCorasick(localClassNames)
    this.layers = new Map()
    this.onCompositionUsed = options.onCompositionUsed ?? markCompositionUsed

    // Class list compositions should be priortized by Newer > Older
    // Therefore we reverse the array as they are added in sequence
    this.composedClassLists = composedClassLists
      .map(({identifier, classList}) => ({
        identifier,
        regex: RegExp(`(${escapeRegex(classList)})`, 'g'),
      }))
      .toReversed()
  }

  processCssObj(root: CSS): void {
    if (root.type === 'fontFace') {
      this.fontFaceRules.push(root.rule)

      return
    }

    if (root.type === 'property') {
      this.propertyRules.push(root)

      return
    }

    if (root.type === 'keyframes') {
      root.rule = Object.fromEntries(
        Object.entries(root.rule).map(([keyframe, rule]) => {
          return [keyframe, this.transformVars(this.transformProperties(rule))]
        }),
      )
      this.keyframesRules.push(root)

      return
    }

    this.currConditionalRuleset = new ConditionalRuleset()

    if (root.type === 'layer') {
      const layerDefinition = `@layer ${root.name}`
      this.addLayer([layerDefinition])
    } else {
      // Add main styles
      const mainRule = omit(root.rule, specialKeys)
      this.addRule({
        selector: root.selector,
        rule: mainRule,
      })

      this.transformLayer(root, root.rule['@layer'])
      this.transformScope(root, root.rule['@scope'])
      this.transformMedia(root, root.rule['@media'])
      this.transformSupports(root, root.rule['@supports'])
      this.transformContainer(root, root.rule['@container'])
      this.transformStartingStyle(root, root.rule['@starting-style'])

      this.transformSimplePseudos(root, root.rule)
      this.transformSelectors(root, root.rule)
    }

    const activeConditionalRuleset = this.conditionalRulesets[this.conditionalRulesets.length - 1]

    if (!activeConditionalRuleset?.mergeIfCompatible(this.currConditionalRuleset)) {
      // Ruleset merge failed due to incompatibility. We now deopt by starting a fresh ConditionalRuleset
      this.conditionalRulesets.push(this.currConditionalRuleset)
    }
  }

  addConditionalRule(cssRule: CSSRule, conditions: Array<string>): void {
    // Run `transformProperties` before `transformVars` as we don't want to pixelify CSS Vars
    const rule = this.transformVars(this.transformProperties(cssRule.rule))
    const selector = this.transformSelector(cssRule.selector)

    if (!this.currConditionalRuleset) {
      throw new Error(`Couldn't add conditional rule`)
    }

    const conditionQuery = conditions[conditions.length - 1]
    const parentConditions = conditions.slice(0, conditions.length - 1)

    if (conditionQuery === undefined) {
      throw new Error(`Couldn't add conditional rule`)
    }

    this.currConditionalRuleset.addRule(
      {
        selector,
        rule,
      },
      conditionQuery,
      parentConditions,
    )
  }

  addRule(cssRule: CSSRule): void {
    // Run `transformProperties` before `transformVars` as we don't want to pixelify CSS Vars
    const rule = this.transformVars(this.transformProperties(cssRule.rule))
    const selector = this.transformSelector(cssRule.selector)

    this.rules.push({
      selector,
      rule,
    })
  }

  addLayer(layer: Array<string>): void {
    const uniqueLayerKey = layer.join(' - ')

    this.layers.set(uniqueLayerKey, layer)
  }

  transformProperties(cssRule: Record<string, unknown>): Record<string, unknown> {
    return this.transformContent(this.pixelifyProperties(cssRule))
  }

  pixelifyProperties(cssRule: Record<string, unknown>): Record<string, unknown> {
    forEach(cssRule, (value, key) => {
      if (typeof value === 'number' && value !== 0 && !UNITLESS[key]) {
        cssRule[key] = `${value}px`
      }
    })

    return cssRule
  }

  transformVars({vars, ...rest}: Record<string, unknown>): Record<string, unknown> {
    if (!vars || typeof vars !== 'object') {
      return rest
    }

    return {
      ...mapKeys(vars, (_value, key) => getVarName(key)),
      ...rest,
    }
  }

  transformContent({content, ...rest}: Record<string, unknown>): Record<string, unknown> {
    if (typeof content === 'undefined') {
      return rest
    }

    // Handle fallback arrays:
    const contentArray: Array<unknown> = Array.isArray(content) ? content : [content]

    return {
      content: contentArray.map((value) =>
        // This logic was adapted from Stitches :)
        typeof value === 'string' &&
        value &&
        (value.includes('"') ||
          value.includes("'") ||
          /^([A-Za-z-]+\([^]*|[^]*-quote|inherit|initial|none|normal|revert|unset)(\s|$)/.test(
            value,
          ))
          ? value
          : `"${String(value)}"`,
      ),
      ...rest,
    }
  }

  transformClassname(identifier: string): string {
    return `.${cssesc(identifier, {
      isIdentifier: true,
    })}`
  }

  transformSelector(selector: string): string {
    // Map class list compositions to single identifiers
    let transformedSelector = selector
    for (const {identifier, regex} of this.composedClassLists) {
      transformedSelector = transformedSelector.replace(regex, () => {
        this.onCompositionUsed(identifier)

        return identifier
      })
    }

    if (this.localClassNamesMap.has(transformedSelector)) {
      return this.transformClassname(transformedSelector)
    }

    const results = this.localClassNamesSearch.search(transformedSelector)

    let lastReplaceIndex = transformedSelector.length

    // Perform replacements backwards to simplify index handling
    for (let i = results.length - 1; i >= 0; i--) {
      const result = results[i]
      if (!result) continue
      const [endIndex, [firstMatch]] = result
      if (firstMatch === undefined) continue
      const startIndex = endIndex - firstMatch.length + 1

      // Class names can be substrings of other class names
      // e.g. '_1g1ptzo1' and '_1g1ptzo10'
      //
      // Additionally, concatenated classnames can contain substrings equal to other classnames
      // e.g. '&&' where '&' is 'debugName_hash1' and 'debugName_hash1d' is also a local classname
      // Before transforming the selector, this would look like `debugName_hash1debugName_hash1`
      // which contains the substring `debugName_hash1d`’.
      //
      // In either of these cases, the last replace index will occur either before or within the
      // current replacement range (from `startIndex` to `endIndex`).
      // If this occurs, we skip the replacement to avoid transforming the selector incorrectly.
      const skipReplacement = lastReplaceIndex <= endIndex

      if (skipReplacement) {
        continue
      }

      lastReplaceIndex = startIndex

      // If class names already starts with a '.' then skip
      if (transformedSelector[startIndex - 1] !== '.') {
        transformedSelector = replaceBetweenIndexes(
          transformedSelector,
          startIndex,
          endIndex + 1,
          this.transformClassname(firstMatch),
        )
      }
    }

    return transformedSelector
  }

  transformSelectors(
    root: CSSStyleBlock | CSSSelectorBlock,
    rule: StyleWithSelectors,
    conditions?: Array<string>,
  ): void {
    for (const [selector, selectorRule] of Object.entries(rule.selectors ?? {})) {
      if (root.type !== 'local') {
        throw new Error(
          `Selectors are not allowed within ${root.type === 'global' ? '"globalStyle"' : '"selectors"'}`,
        )
      }

      const transformedSelector = this.transformSelector(
        selector.replace(RegExp('&', 'g'), root.selector),
      )
      validateSelector(transformedSelector, root.selector)

      const selectorCssRule = {
        selector: transformedSelector,
        rule: omit(selectorRule, specialKeys),
      }

      if (conditions) {
        this.addConditionalRule(selectorCssRule, conditions)
      } else {
        this.addRule(selectorCssRule)
      }

      const selectorRoot: CSSSelectorBlock = {
        type: 'selector',
        selector: transformedSelector,
        rule: selectorRule,
      }

      this.transformLayer(selectorRoot, selectorRule['@layer'], conditions)
      this.transformScope(selectorRoot, selectorRule['@scope'], conditions)
      this.transformSupports(selectorRoot, selectorRule['@supports'], conditions)
      this.transformMedia(selectorRoot, selectorRule['@media'], conditions)
      this.transformContainer(selectorRoot, selectorRule['@container'], conditions)
      this.transformStartingStyle(selectorRoot, selectorRule['@starting-style'], conditions)
    }
  }

  transformMedia(
    root: CSSStyleBlock | CSSSelectorBlock,
    rules: QueryRules<'@media'>,
    parentConditions: Array<string> = [],
  ): void {
    if (rules) {
      this.currConditionalRuleset?.addConditionPrecedence(
        parentConditions,
        Object.keys(rules).map((query) => `@media ${query}`),
      )

      for (const [query, mediaRule] of Object.entries(rules)) {
        const mediaQuery = `@media ${query}`

        validateMediaQuery(mediaQuery)

        const conditions = [...parentConditions, mediaQuery]

        this.addConditionalRule(
          {
            selector: root.selector,
            rule: omit(mediaRule, specialKeys),
          },
          conditions,
        )

        if (root.type === 'local') {
          this.transformSimplePseudos(root, mediaRule, conditions)
          this.transformSelectors(root, mediaRule, conditions)
        }

        this.transformLayer(root, mediaRule['@layer'], conditions)
        this.transformScope(root, mediaRule['@scope'], conditions)
        this.transformSupports(root, mediaRule['@supports'], conditions)
        this.transformContainer(root, mediaRule['@container'], conditions)
        this.transformStartingStyle(root, mediaRule['@starting-style'], conditions)
      }
    }
  }

  transformContainer(
    root: CSSStyleBlock | CSSSelectorBlock,
    rules: QueryRules<'@container'>,
    parentConditions: Array<string> = [],
  ): void {
    if (rules) {
      this.currConditionalRuleset?.addConditionPrecedence(
        parentConditions,
        Object.keys(rules).map((query) => `@container ${query}`),
      )

      for (const [query, containerRule] of Object.entries(rules)) {
        const containerQuery = `@container ${query}`

        const conditions = [...parentConditions, containerQuery]

        this.addConditionalRule(
          {
            selector: root.selector,
            rule: omit(containerRule, specialKeys),
          },
          conditions,
        )

        if (root.type === 'local') {
          this.transformSimplePseudos(root, containerRule, conditions)
          this.transformSelectors(root, containerRule, conditions)
        }

        this.transformLayer(root, containerRule['@layer'], conditions)
        this.transformScope(root, containerRule['@scope'], conditions)
        this.transformSupports(root, containerRule['@supports'], conditions)
        this.transformMedia(root, containerRule['@media'], conditions)
        this.transformStartingStyle(root, containerRule['@starting-style'], conditions)
      }
    }
  }

  transformLayer(
    root: CSSStyleBlock | CSSSelectorBlock,
    rules: QueryRules<'@layer'>,
    parentConditions: Array<string> = [],
  ): void {
    if (rules) {
      this.currConditionalRuleset?.addConditionPrecedence(
        parentConditions,
        Object.keys(rules).map((name) => `@layer ${name}`),
      )

      for (const [name, layerRule] of Object.entries(rules)) {
        const conditions = [...parentConditions, `@layer ${name}`]
        this.addLayer(conditions)

        this.addConditionalRule(
          {
            selector: root.selector,
            rule: omit(layerRule, specialKeys),
          },
          conditions,
        )

        if (root.type === 'local') {
          this.transformSimplePseudos(root, layerRule, conditions)
          this.transformSelectors(root, layerRule, conditions)
        }

        this.transformScope(root, layerRule['@scope'], conditions)
        this.transformMedia(root, layerRule['@media'], conditions)
        this.transformSupports(root, layerRule['@supports'], conditions)
        this.transformContainer(root, layerRule['@container'], conditions)
        this.transformStartingStyle(root, layerRule['@starting-style'], conditions)
      }
    }
  }

  transformScope(
    root: CSSStyleBlock | CSSSelectorBlock,
    rules: QueryRules<'@scope'>,
    parentConditions: Array<string> = [],
  ): void {
    if (rules) {
      const transformedScopeBounds: Record<string, string> = {}
      this.currConditionalRuleset?.addConditionPrecedence(
        parentConditions,
        Object.keys(rules).map((bounds) => {
          const transformedBounds = `@scope ${this.transformSelector(
            bounds.replace(nestingSelectorRegex, root.selector),
          )}`
          transformedScopeBounds[bounds] = transformedBounds
          return transformedBounds
        }),
      )

      for (const [bounds, scopeRule] of Object.entries(rules)) {
        const transformedBounds = transformedScopeBounds[bounds]
        if (transformedBounds === undefined) continue

        const conditions = [...parentConditions, transformedBounds]

        this.addConditionalRule(
          {
            selector: root.selector,
            rule: omit(scopeRule, specialKeys),
          },
          conditions,
        )

        if (root.type === 'local') {
          this.transformSimplePseudos(root, scopeRule, conditions)
          this.transformSelectors(root, scopeRule, conditions)
        }

        this.transformLayer(root, scopeRule['@layer'], conditions)
        this.transformMedia(root, scopeRule['@media'], conditions)
        this.transformSupports(root, scopeRule['@supports'], conditions)
        this.transformContainer(root, scopeRule['@container'], conditions)
        this.transformStartingStyle(root, scopeRule['@starting-style'], conditions)
      }
    }
  }

  transformSupports(
    root: CSSStyleBlock | CSSSelectorBlock,
    rules: QueryRules<'@supports'>,
    parentConditions: Array<string> = [],
  ): void {
    if (rules) {
      this.currConditionalRuleset?.addConditionPrecedence(
        parentConditions,
        Object.keys(rules).map((query) => `@supports ${query}`),
      )

      for (const [query, supportsRule] of Object.entries(rules)) {
        const conditions = [...parentConditions, `@supports ${query}`]

        this.addConditionalRule(
          {
            selector: root.selector,
            rule: omit(supportsRule, specialKeys),
          },
          conditions,
        )

        if (root.type === 'local') {
          this.transformSimplePseudos(root, supportsRule, conditions)
          this.transformSelectors(root, supportsRule, conditions)
        }

        this.transformLayer(root, supportsRule['@layer'], conditions)
        this.transformScope(root, supportsRule['@scope'], conditions)
        this.transformMedia(root, supportsRule['@media'], conditions)
        this.transformContainer(root, supportsRule['@container'], conditions)
        this.transformStartingStyle(root, supportsRule['@starting-style'], conditions)
      }
    }
  }

  transformSimplePseudos(
    root: CSSStyleBlock | CSSSelectorBlock,
    rule: StyleRule,
    conditions?: Array<string>,
  ): void {
    for (const [key, value] of Object.entries(toRecord(rule))) {
      // Process simple pseudos
      if (simplePseudoLookup[key]) {
        if (root.type !== 'local') {
          throw new Error(
            `Simple pseudos are not valid in ${root.type === 'global' ? '"globalStyle"' : '"selectors"'}`,
          )
        }

        const pseudoRule = typeof value === 'object' && value !== null ? toRecord(value) : {}

        if (conditions) {
          this.addConditionalRule(
            {
              selector: `${root.selector}${key}`,
              rule: pseudoRule,
            },
            conditions,
          )
        } else {
          this.addRule({
            conditions,
            selector: `${root.selector}${key}`,
            rule: pseudoRule,
          })
        }
      }
    }
  }

  transformStartingStyle(
    root: CSSStyleBlock | CSSSelectorBlock,
    rules: QueryRules<'@starting-style'>,
    parentConditions: Array<string> = [],
  ): void {
    if (rules) {
      const nestedAtRuleKey = Object.keys(rules).find((key) => key.startsWith('@'))

      if (nestedAtRuleKey) {
        throw new Error(
          `Nested at-rules (e.g. "${nestedAtRuleKey}") are not allowed inside @starting-style.`,
        )
      }

      this.currConditionalRuleset?.addConditionPrecedence(parentConditions, ['@starting-style'])

      const conditions = [...parentConditions, '@starting-style']

      this.addConditionalRule(
        {
          selector: root.selector,
          rule: omit(rules, specialKeys),
        },
        conditions,
      )

      if (root.type === 'local') {
        this.transformSimplePseudos(root, rules, conditions)
        this.transformSelectors(root, rules, conditions)
      }
    }
  }

  toCss(): Array<string> {
    const css: Array<string> = []

    // Render font-face rules
    for (const fontFaceRule of this.fontFaceRules) {
      css.push(renderCss({'@font-face': fontFaceRule}))
    }

    // Render property rules
    for (const property of this.propertyRules) {
      css.push(renderCss({[`@property ${property.name}`]: property.rule}))
    }

    // Render keyframes
    for (const keyframe of this.keyframesRules) {
      css.push(renderCss({[`@keyframes ${keyframe.name}`]: keyframe.rule}))
    }

    // Render layer definitions
    for (const layer of this.layers.values()) {
      const [definition, ...nesting] = layer.toReversed()
      if (definition === undefined) continue
      let cssObj: Record<string, unknown> = {
        [definition]: DECLARATION,
      }

      for (const part of nesting) {
        cssObj = {
          [part]: cssObj,
        }
      }

      css.push(renderCss(cssObj))
    }

    // Render unconditional rules
    for (const rule of this.rules) {
      css.push(renderCss({[rule.selector]: rule.rule}))
    }

    // Render conditional rules
    for (const conditionalRuleset of this.conditionalRulesets) {
      for (const conditionalRule of conditionalRuleset.renderToArray()) {
        css.push(renderCss(conditionalRule))
      }
    }

    return css.filter(Boolean)
  }
}

export function renderCss(block: Record<string, unknown>, indent: string = ''): string {
  const rules: Array<string> = []

  for (const key of Object.keys(block)) {
    const value = block[key]

    if (value && Array.isArray(value)) {
      rules.push(...value.map((item: unknown) => renderCss({[key]: item}, indent)))
    } else if (value && typeof value === 'object') {
      const isEmpty = Object.keys(value).length === 0

      if (!isEmpty) {
        rules.push(
          `${indent}${key} {\n${renderCss(toRecord(value), indent + DOUBLE_SPACE)}\n${indent}}`,
        )
      }
    } else if (value === DECLARATION) {
      rules.push(`${indent}${key};`)
    } else {
      rules.push(`${indent}${key.startsWith('--') ? key : dashify(key)}: ${String(value)};`)
    }
  }

  return rules.join('\n')
}

/** @public */
export interface TransformCssParams extends StylesheetOptions {
  localClassNames: Array<string>
  composedClassLists: Array<Composition>
  cssObjs: Array<CSS>
}

/**
 * Renders the CSS objects collected by an adapter into CSS rules, one string per top-level rule
 * — the vendored equivalent of `transformCss` from `@vanilla-extract/css/transformCss`.
 * @public
 */
export function transformCss({
  localClassNames,
  cssObjs,
  composedClassLists,
  ...options
}: TransformCssParams): string[] {
  const stylesheet = new Stylesheet(localClassNames, composedClassLists, options)

  for (const root of cssObjs) {
    stylesheet.processCssObj(root)
  }

  return stylesheet.toCss()
}
