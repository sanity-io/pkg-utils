import {describe, expect, test} from 'vitest'
import {
  createAdapterIdentOption,
  createFileScopePackageName,
  parseFileScopePackageName,
} from '../src/fileScopePackageName.ts'
import type {IdentifierOption} from '../src/types.ts'

/** The first 8 hex chars of `md5('a')`. */
const digestOfA = '0cc175b9'

describe('createFileScopePackageName', () => {
  test('qualifies the package name with the version and a digest of the source', () => {
    expect(createFileScopePackageName({name: '@sanity/ui', version: '4.4.4', source: 'a'})).toBe(
      `@sanity/ui@4.4.4+${digestOfA}`,
    )
  })

  test('treats a package without a version as 0.0.0', () => {
    expect(createFileScopePackageName({name: 'my-app', source: 'a'})).toBe(
      `my-app@0.0.0+${digestOfA}`,
    )
    expect(createFileScopePackageName({name: 'my-app', version: undefined, source: 'a'})).toBe(
      `my-app@0.0.0+${digestOfA}`,
    )
  })

  test('is deterministic for identical input and differs per version and source', () => {
    const params = {name: '@sanity/ui', version: '4.4.4', source: 'export const a = 1'}
    const packageName = createFileScopePackageName(params)

    expect(createFileScopePackageName({...params})).toBe(packageName)
    expect(createFileScopePackageName({...params, version: '4.4.5'})).not.toBe(packageName)
    expect(createFileScopePackageName({...params, source: 'export const a = 2'})).not.toBe(
      packageName,
    )
    expect(createFileScopePackageName({...params, name: '@sanity/ui-next'})).not.toBe(packageName)
  })

  test('digests the source independently of its line endings', () => {
    const lf = 'export const a = 1\nexport const b = 2\n'
    const crlf = lf.replaceAll('\n', '\r\n')

    expect(createFileScopePackageName({name: 'pkg', version: '1.0.0', source: crlf})).toBe(
      createFileScopePackageName({name: 'pkg', version: '1.0.0', source: lf}),
    )
  })
})

describe('parseFileScopePackageName', () => {
  test('splits a qualified name into its parts', () => {
    expect(parseFileScopePackageName(`@sanity/ui@4.4.4+${digestOfA}`)).toEqual({
      name: '@sanity/ui',
      version: '4.4.4',
      digest: digestOfA,
    })
    expect(parseFileScopePackageName('my-app@0.0.0+deadbeef')).toEqual({
      name: 'my-app',
      version: '0.0.0',
      digest: 'deadbeef',
    })
  })

  test('keeps build metadata in the version', () => {
    expect(parseFileScopePackageName('my-app@1.0.0-rc.1+build.5+deadbeef')).toEqual({
      name: 'my-app',
      version: '1.0.0-rc.1+build.5',
      digest: 'deadbeef',
    })
  })

  test('parses a bare package name to just the name', () => {
    expect(parseFileScopePackageName('@sanity/ui')).toEqual({name: '@sanity/ui'})
    expect(parseFileScopePackageName('my-app')).toEqual({name: 'my-app'})
  })

  test('round-trips createFileScopePackageName', () => {
    const params = {name: '@scope/pkg', version: '1.2.3-beta.4', source: 'x'}
    const {name, version, digest} = parseFileScopePackageName(createFileScopePackageName(params))
    expect({name, version}).toEqual({name: params.name, version: params.version})
    expect(digest).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('createAdapterIdentOption', () => {
  test('passes the string options through unchanged', () => {
    expect(createAdapterIdentOption('short')).toBe('short')
    expect(createAdapterIdentOption('debug')).toBe('debug')
  })

  test('hands custom identifier functions the bare package name', () => {
    const seen: Parameters<Extract<IdentifierOption, (...args: never) => unknown>>[0][] = []
    const identOption = createAdapterIdentOption((params) => {
      seen.push(params)
      return `custom_${params.hash}`
    })
    expect(identOption).toBeTypeOf('function')
    if (typeof identOption !== 'function') throw new Error('expected a function')

    const result = identOption({
      hash: 'abc1230',
      filePath: 'src/styles.css.ts',
      debugId: 'box',
      packageName: `@sanity/ui@4.4.4+${digestOfA}`,
    })

    expect(result).toBe('custom_abc1230')
    expect(seen).toEqual([
      {hash: 'abc1230', filePath: 'src/styles.css.ts', debugId: 'box', packageName: '@sanity/ui'},
    ])
  })

  test('leaves a missing package name alone', () => {
    const identOption = createAdapterIdentOption(({packageName}) => String(packageName))
    if (typeof identOption !== 'function') throw new Error('expected a function')

    expect(identOption({hash: 'abc1230', filePath: 'src/styles.css.ts'})).toBe('undefined')
  })
})
