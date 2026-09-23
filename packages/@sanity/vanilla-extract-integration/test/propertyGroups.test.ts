import {describe, expect, test} from 'vitest'
import {isShorthand, physicalLonghands, propertiesOverlap} from '../src/atomic/propertyGroups.ts'
import stylexApplicationOrder from './fixtures/stylex/application-order.json'
import stylexPriorities from './fixtures/stylex/property-priorities.json'

const camelCase = (property: string): string =>
  property
    .replace(/^-ms-/, 'ms-')
    .replace(
      /^-(webkit|moz|o)-/,
      (_, vendor: string) => `${vendor[0]!.toUpperCase()}${vendor.slice(1)}-`,
    )
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())

describe('propertiesOverlap', () => {
  test.each([
    ['padding', 'paddingBottom'],
    ['paddingBottom', 'padding'],
    ['padding', 'paddingInline'],
    ['paddingInline', 'paddingLeft'],
    ['border', 'borderColor'],
    ['border', 'borderTopColor'],
    ['borderTop', 'borderColor'],
    ['borderBlockStart', 'borderTopWidth'],
    ['marginInlineStart', 'marginLeft'],
    ['marginInlineStart', 'marginTop'],
    ['marginInlineStart', 'marginInlineEnd'],
    ['inset', 'top'],
    ['insetInlineStart', 'left'],
    ['inlineSize', 'width'],
    ['minBlockSize', 'minHeight'],
    ['font', 'lineHeight'],
    ['font', 'fontWeight'],
    ['background', 'backgroundColor'],
    ['borderRadius', 'borderStartStartRadius'],
    ['flex', 'flexGrow'],
    ['transition', 'transitionDuration'],
    ['placeItems', 'alignItems'],
    ['overflow', 'overflowInline'],
    ['whiteSpace', 'textWrap'],
    ['gridGap', 'gap'],
    ['gridGap', 'rowGap'],
    ['WebkitTransition', 'transition'],
    ['all', 'color'],
    ['all', 'padding'],
    ['--brand', '--brand'],
    ['display', 'display'],
  ])('%s overlaps %s', (a, b) => {
    expect(propertiesOverlap(a, b)).toBe(true)
    expect(propertiesOverlap(b, a)).toBe(true)
  })

  test.each([
    ['padding', 'margin'],
    ['paddingTop', 'paddingBottom'],
    ['marginInlineStart', 'paddingLeft'],
    ['borderTopColor', 'borderTopWidth'],
    ['display', 'position'],
    ['inlineSize', 'minWidth'],
    ['all', 'direction'],
    ['all', 'unicodeBidi'],
    ['all', '--brand'],
    ['--brand', '--accent'],
    ['--brand', 'color'],
    ['WebkitLineClamp', 'lineHeight'],
  ])('%s does not overlap %s', (a, b) => {
    expect(propertiesOverlap(a, b)).toBe(false)
    expect(propertiesOverlap(b, a)).toBe(false)
  })

  test('expands shorthands of shorthands and logical properties to physical longhands', () => {
    expect([...physicalLonghands('border')].toSorted((a, b) => a.localeCompare(b))).toEqual(
      ['Top', 'Right', 'Bottom', 'Left']
        .flatMap((side) => ['Width', 'Style', 'Color'].map((part) => `border${side}${part}`))
        .toSorted((a, b) => a.localeCompare(b)),
    )
    expect([...physicalLonghands('marginBlock')]).toEqual([
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
    ])
    expect([...physicalLonghands('color')]).toEqual(['color'])
    expect([...physicalLonghands('all')]).toEqual(['*'])
    expect(isShorthand('padding')).toBe(true)
    expect(isShorthand('all')).toBe(true)
    expect(isShorthand('paddingTop')).toBe(false)
  })

  test('logical border side shorthands reach every physical side of their parts', () => {
    // `mdn-data` describes these by their computed physical longhands (`border-block-end` by
    // `border-top-*`), which would let `borderBlockEnd` slip past `borderBottomWidth`
    for (const side of ['BlockStart', 'BlockEnd', 'InlineStart', 'InlineEnd']) {
      expect(
        [...physicalLonghands(`border${side}`)].toSorted((a, b) => a.localeCompare(b)),
      ).toEqual(
        ['Top', 'Right', 'Bottom', 'Left']
          .flatMap((physical) =>
            ['Width', 'Style', 'Color'].map((part) => `border${physical}${part}`),
          )
          .toSorted((a, b) => a.localeCompare(b)),
      )
    }
    expect(propertiesOverlap('borderBlockEnd', 'borderBottomWidth')).toBe(true)
    expect(propertiesOverlap('borderInlineEnd', 'borderRightColor')).toBe(true)
    expect(propertiesOverlap('borderBlockEnd', 'borderRadius')).toBe(false)
  })
})

/**
 * StyleX-only spellings (React Native heritage) that its alias table maps onto standard
 * properties; anything else StyleX nulls must be a property this table knows.
 */
const resolveStylexAlias = (property: string): string =>
  (stylexApplicationOrder.aliases as Record<string, string>)[property] ?? property

describe('cross-check against StyleX', () => {
  test("every property StyleX's application-order resolution nulls overlaps its shorthand", () => {
    // `application-order.js` lists, per shorthand, the properties writing it resets; that is
    // exactly the overlap relation, so it must be a subset of ours
    const unknown = new Set<string>()
    for (const [shorthand, nulled] of Object.entries(stylexApplicationOrder.nulls)) {
      const source = resolveStylexAlias(shorthand)
      for (const property of nulled) {
        const target = resolveStylexAlias(property)
        if (!propertiesOverlap(source, target)) unknown.add(`${source} -> ${target}`)
      }
    }
    expect([...unknown].toSorted((a, b) => a.localeCompare(b))).toEqual([])
  })

  test("every shorthand in StyleX's priority table is a shorthand here", () => {
    const stylexShorthands = [
      ...stylexPriorities.shorthandsOfShorthands,
      ...stylexPriorities.shorthandsOfLonghands,
    ].map(camelCase)
    const missing = stylexShorthands.filter((property) => !isShorthand(property))
    // `grid-template-areas` is a longhand (StyleX files it with the shorthands for its own
    // priority purposes)
    expect(missing).toEqual(['gridTemplateAreas'])
  })

  test("no longhand in StyleX's priority table is a shorthand here", () => {
    const stylexLonghands = [
      ...stylexPriorities.longHandLogical,
      ...stylexPriorities.longHandPhysical,
    ].map(camelCase)
    const misclassified = stylexLonghands.filter((property) => isShorthand(property))
    // Properties that became shorthands after StyleX's table was written: `border-block-*`
    // set both block sides, and `white-space` / `text-wrap` expand to their `-mode`/`-style`
    // longhands since CSS Text 4
    expect(misclassified.toSorted((a, b) => a.localeCompare(b))).toEqual([
      'borderBlockColor',
      'borderBlockWidth',
      'textWrap',
      'whiteSpace',
    ])
  })
})
