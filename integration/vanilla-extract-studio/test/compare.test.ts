import {describe, expect, test} from 'vitest'
import {
  alignClassRecords,
  alignFixtureClasses,
  normalizeClassRecord,
  replaceClasses,
} from './compare.ts'

describe('alignClassRecords', () => {
  test('maps both sides positionally onto shared placeholders', () => {
    const alignment = alignClassRecords(
      {dialog: 'aaa', button: 'bbb ccc'},
      {dialog: 'xxx', button: 'yyy zzz'},
    )

    expect(
      normalizeClassRecord({dialog: 'aaa', button: 'bbb ccc'}, alignment.forkToPlaceholder),
    ).toEqual({
      dialog: '__VE_CLASS_2__',
      button: '__VE_CLASS_0__ __VE_CLASS_1__',
    })
    expect(
      normalizeClassRecord({dialog: 'xxx', button: 'yyy zzz'}, alignment.upstreamToPlaceholder),
    ).toEqual({
      dialog: '__VE_CLASS_2__',
      button: '__VE_CLASS_0__ __VE_CLASS_1__',
    })
  })

  test('reuses the placeholder of a class shared between exports', () => {
    const alignment = alignClassRecords({a: 'shared', b: 'shared'}, {a: 's1', b: 's1'})

    // Both sides share one class across two exports: the structure matches, so both map
    // onto a single placeholder
    expect(alignment.forkToPlaceholder.get('shared')).toBe('__VE_CLASS_0__')
    expect(alignment.upstreamToPlaceholder.get('s1')).toBe('__VE_CLASS_0__')
  })

  test('throws when the exports or class lists differ in shape', () => {
    expect(() => alignClassRecords({a: 'x'}, {b: 'x'})).toThrow(/exports differ/)
    expect(() => alignClassRecords({a: 'x y'}, {a: 'x'})).toThrow(/differs/)
    // Fork shares a class across exports that upstream does not: structural divergence
    expect(() => alignClassRecords({a: 'x', b: 'x'}, {a: 'y', b: 'z'})).toThrow(/sharing differs/)
  })

  test('aligns the fixture exports', () => {
    const alignment = alignFixtureClasses(
      {dialog: 'd1', overlay: 'o1', button: 'b1 b0'},
      {dialog: 'd2', overlay: 'o2', button: 'c1 c0'},
    )
    expect([...alignment.forkToPlaceholder.values()]).toEqual([
      '__VE_CLASS_0__',
      '__VE_CLASS_1__',
      '__VE_CLASS_2__',
      '__VE_CLASS_3__',
    ])
  })
})

describe('replaceClasses', () => {
  test('replaces longest-first with identifier boundaries', () => {
    const mapping = new Map([
      ['abc', '__VE_CLASS_0__'],
      ['abcdef', '__VE_CLASS_1__'],
    ])

    // The longer class wins over its prefix… (selectors, HTML class attributes)
    expect(replaceClasses('.abcdef{}.abc{}', mapping)).toBe('.__VE_CLASS_1__{}.__VE_CLASS_0__{}')
    // …and identifier characters around a match block the replacement
    expect(replaceClasses('.xabc .abcx abc', mapping)).toBe('.xabc .abcx __VE_CLASS_0__')
  })

  test('normalizes fork and upstream CSS onto the same text', () => {
    const alignment = alignClassRecords({box: 'fork123'}, {box: 'up456'})
    const forkCss = '.fork123{color:red}.other{color:blue}'
    const upstreamCss = '.up456{color:red}.other{color:blue}'

    expect(replaceClasses(forkCss, alignment.forkToPlaceholder)).toBe(
      replaceClasses(upstreamCss, alignment.upstreamToPlaceholder),
    )
    expect(replaceClasses(forkCss, alignment.forkToPlaceholder)).toContain('.other')
  })
})
