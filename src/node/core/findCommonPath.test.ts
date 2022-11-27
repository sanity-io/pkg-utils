import {expect, test} from 'vitest'
import {_findCommonDirPath} from './_findCommonPath'

test('should find common parent directory of paths', () => {
  expect(_findCommonDirPath(['test/a', 'test/b/a'])).toBe('test')
  expect(_findCommonDirPath(['/test/a', '/test/b/a'])).toBe('/test')
  expect(_findCommonDirPath(['/test/a/b', '/test/a/b/c'])).toBe('/test/a')
  expect(_findCommonDirPath(['test/a/b', 'test/a/b', 'test/b/c', 'test/b/a'])).toBe('test')
})
