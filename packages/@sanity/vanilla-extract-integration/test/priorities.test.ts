import {describe, expect, test} from 'vitest'
import {
  AT_RULE_PRIORITIES,
  conditionPriority,
  declarationPriority,
  isShorthandOfShorthands,
  priorityLayer,
  propertyPriority,
  PSEUDO_CLASS_PRIORITIES,
  PSEUDO_ELEMENT_PRIORITY,
  selectorPriority,
} from '../src/atomic/priorities.ts'
import {SHORTHAND_LONGHANDS} from '../src/atomic/propertyGroups.generated.ts'
import stylexPriorities from './fixtures/stylex/property-priorities.json'

const camelCase = (property: string): string =>
  property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())

describe('propertyPriority', () => {
  test.each([
    ['--brand', 1],
    ['all', 1000],
    ['border', 1000],
    ['margin', 1000],
    ['inset', 1000],
    ['font', 1000],
    ['background', 1000],
    ['animation', 1000],
    ['grid', 1000],
    ['borderWidth', 2000],
    ['marginBlock', 2000],
    ['paddingInline', 2000],
    ['borderBlockStart', 2000],
    ['flex', 2000],
    ['whiteSpace', 2000],
    ['marginBlockStart', 3000],
    ['inlineSize', 3000],
    ['color', 3000],
    ['display', 3000],
    ['fontWeight', 3000],
    ['marginTop', 4000],
    ['width', 4000],
    ['left', 4000],
    ['borderTopLeftRadius', 4000],
    ['overflowX', 4000],
    ['WebkitMask', 2000],
    ['WebkitMaskImage', 3000],
  ])('%s → %i', (property, priority) => {
    expect(propertyPriority(property)).toBe(priority)
  })

  test('ranks every shorthand below every longhand it sets', () => {
    const violations: string[] = []
    for (const [shorthand, longhands] of Object.entries(SHORTHAND_LONGHANDS)) {
      for (const longhand of longhands) {
        if (propertyPriority(shorthand) >= propertyPriority(longhand)) {
          violations.push(
            `${shorthand} (${propertyPriority(shorthand)}) ≥ ${longhand} (${propertyPriority(longhand)})`,
          )
        }
      }
    }
    expect(violations).toEqual([])
  })

  test('ranks logical longhands below the physical ones they resolve to', () => {
    for (const [logical, physical] of [
      ['marginInlineStart', 'marginLeft'],
      ['paddingBlockEnd', 'paddingBottom'],
      ['insetInlineEnd', 'right'],
      ['borderStartStartRadius', 'borderTopLeftRadius'],
      ['cornerStartStartShape', 'cornerTopLeftShape'],
      ['inlineSize', 'width'],
      ['minBlockSize', 'minHeight'],
      ['overflowInline', 'overflowX'],
      ['containIntrinsicBlockSize', 'containIntrinsicHeight'],
    ]) {
      expect(propertyPriority(logical!), logical).toBeLessThan(propertyPriority(physical!))
    }
  })

  test('isShorthandOfShorthands derives the sided and nested shorthands', () => {
    expect(
      [
        'margin',
        'padding',
        'inset',
        'scrollMargin',
        'scrollPadding',
        'border',
        'borderBlock',
        'borderInline',
        'font',
        'background',
        'gridArea',
      ].filter((property) => !isShorthandOfShorthands(property)),
    ).toEqual([])
    expect(
      [
        'borderWidth',
        'marginBlock',
        'gridTemplate',
        'flex',
        'color',
        'marginTop',
        '--brand',
      ].filter(isShorthandOfShorthands),
    ).toEqual([])
  })
})

describe('cross-check against StyleX', () => {
  const buckets = {
    shorthandsOfShorthands: 1000,
    shorthandsOfLonghands: 2000,
    longHandLogical: 3000,
    longHandPhysical: 4000,
  } as const

  test.each(Object.entries(buckets))(
    '%s → %i, up to the documented differences',
    (bucket, priority) => {
      const properties = stylexPriorities[bucket as keyof typeof buckets]
      const differences = properties
        .filter((property) => propertyPriority(camelCase(property)) !== priority)
        .map((property) => `${property}: ${propertyPriority(camelCase(property))}`)
      expect(differences).toEqual(
        {
          // StyleX files `grid-template` next to `grid`, the shorthand that sets it
          shorthandsOfShorthands: ['grid-template: 2000'],
          // ...and `grid-template-areas`, a longhand, with the shorthands
          shorthandsOfLonghands: ['grid-template-areas: 3000'],
          // `border-block-*`, `white-space` and `text-wrap` became shorthands after StyleX's table
          // was written; `contain-intrinsic-width`/`-height` have logical counterparts
          // (`contain-intrinsic-inline-size`/`-block-size`) and so rank as physical
          longHandLogical: [
            'border-block-color: 2000',
            'border-block-width: 2000',
            'contain-intrinsic-height: 4000',
            'contain-intrinsic-width: 4000',
            'text-wrap: 2000',
            'white-space: 2000',
          ],
          // `line-clamp` and `max-lines` have no logical counterpart to rank above
          longHandPhysical: ['line-clamp: 3000', 'max-lines: 3000'],
        }[bucket],
      )
    },
  )

  test('pseudo-class and at-rule priorities match', () => {
    // Spot checks against `property-priorities.js`
    expect(PSEUDO_CLASS_PRIORITIES[':is']).toBe(40)
    expect(PSEUDO_CLASS_PRIORITIES[':nth-child']).toBe(60)
    expect(PSEUDO_CLASS_PRIORITIES[':link']).toBe(80)
    expect(PSEUDO_CLASS_PRIORITIES[':visited']).toBe(85)
    expect(PSEUDO_CLASS_PRIORITIES[':checked']).toBe(101)
    expect(PSEUDO_CLASS_PRIORITIES[':hover']).toBe(130)
    expect(PSEUDO_CLASS_PRIORITIES[':focus-within']).toBe(140)
    expect(PSEUDO_CLASS_PRIORITIES[':focus']).toBe(150)
    expect(PSEUDO_CLASS_PRIORITIES[':focus-visible']).toBe(160)
    expect(PSEUDO_CLASS_PRIORITIES[':active']).toBe(170)
    expect(Object.keys(PSEUDO_CLASS_PRIORITIES)).toHaveLength(53)
    expect(AT_RULE_PRIORITIES).toEqual({'@supports': 30, '@media': 200, '@container': 300})
    expect(PSEUDO_ELEMENT_PRIORITY).toBe(5000)
  })
})

describe('selectorPriority', () => {
  test.each([
    ['&', 0],
    ['&:hover', 130],
    ['&:focus-visible', 160],
    ['&:nth-child(2n + 1)', 60],
    ['&:not(:disabled)', 40],
    ['&:unknown-pseudo', 40],
    ['&::before', 5000],
    ['&:hover::before', 5130],
    ['&:hover:focus', 280],
    ['.parent &', 0],
    ['& + &', 0],
    ['.parent:hover &', 130],
  ])('%s → %i', (selector, priority) => {
    expect(selectorPriority(selector)).toBe(priority)
  })
})

describe('conditionPriority', () => {
  test.each([
    ['@media (min-width: 600px)', 200],
    ['@media screen and (prefers-reduced-motion)', 200],
    ['@supports (display: grid)', 30],
    ['@container sidebar (min-width: 400px)', 300],
    ['@layer base', 0],
    ['@starting-style', 0],
  ])('%s → %i', (condition, priority) => {
    expect(conditionPriority(condition)).toBe(priority)
  })
})

describe('declarationPriority', () => {
  test('adds the property, selector and condition priorities', () => {
    expect(declarationPriority({property: 'padding', selector: '&:hover'})).toBe(1130)
    expect(
      declarationPriority({property: 'paddingTop', conditions: ['@media (min-width: 600px)']}),
    ).toBe(4200)
    expect(
      declarationPriority({
        property: 'color',
        conditions: ['@supports (display: grid)', '@media (min-width: 600px)'],
        selector: '&:hover::before',
      }),
    ).toBe(3000 + 30 + 200 + 130 + 5000)
    expect(declarationPriority({property: '--brand'})).toBe(1)
  })

  test('priorityLayer groups by thousands', () => {
    expect(priorityLayer(1)).toBe('priority0')
    expect(priorityLayer(1130)).toBe('priority1')
    expect(priorityLayer(4200)).toBe('priority4')
    expect(priorityLayer(8360)).toBe('priority8')
  })
})
