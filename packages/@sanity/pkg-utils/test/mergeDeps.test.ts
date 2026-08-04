import {expect, test} from 'vitest'
import {mergeDeps} from '../src/node/resolveBuildContext'

const additions = {
  neverBundle: ['@sanity/logos', /^my-pkg(\/|$)/] as (string | RegExp)[],
  alwaysBundle: [] as (string | RegExp)[],
}

test('returns the derived additions when userland passes no deps', () => {
  expect(mergeDeps(undefined, additions)).toEqual({neverBundle: additions.neverBundle})
})

test('concatenates array forms after the derived additions', () => {
  const deps = mergeDeps({neverBundle: ['lodash']}, additions)
  expect(deps?.neverBundle).toEqual(['@sanity/logos', /^my-pkg(\/|$)/, 'lodash'])
})

test('composes a userland neverBundle function with the derived additions', () => {
  // The additions carry pipeline invariants (the self-reference external, the deprecated
  // `external` mapping), which must survive a userland function instead of being replaced
  const deps = mergeDeps({neverBundle: (id) => id === 'lodash'}, additions)
  const neverBundle = deps?.neverBundle
  if (typeof neverBundle !== 'function') throw new Error('expected a composed function')

  // self-reference pattern from the additions
  expect(neverBundle('my-pkg/bundle.css', undefined, false)).toBe(true)
  expect(neverBundle('my-pkg', undefined, false)).toBe(true)
  // string addition from the deprecated `external` mapping
  expect(neverBundle('@sanity/logos', undefined, false)).toBe(true)
  // the userland function still decides everything else
  expect(neverBundle('lodash', undefined, false)).toBe(true)
  expect(neverBundle('react', undefined, false)).toBeFalsy()
})

test('a blanket `neverBundle: true` wins as the broadest request', () => {
  expect(mergeDeps({neverBundle: true}, additions)?.neverBundle).toBe(true)
})

const alwaysBundleFn = () => true

test('merges alwaysBundle additions with userland values', () => {
  const withAdditions = {...additions, alwaysBundle: [/^@sanity\/icons(\/|$)/] as (string | RegExp)[]}
  expect(mergeDeps(undefined, withAdditions)?.alwaysBundle).toEqual([/^@sanity\/icons(\/|$)/])
  expect(mergeDeps({alwaysBundle: ['some-dep']}, withAdditions)?.alwaysBundle).toEqual([
    /^@sanity\/icons(\/|$)/,
    'some-dep',
  ])
  // a userland function wins (there are no invariant alwaysBundle additions to preserve
  // beyond the deprecated `external` callback mapping, which cannot combine with a function)
  expect(mergeDeps({alwaysBundle: alwaysBundleFn}, withAdditions)?.alwaysBundle).toBe(
    alwaysBundleFn,
  )
})
