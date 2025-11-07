import {expect, test} from 'vitest'
import {findCommonDirPath} from './findCommonPath.ts'

test('should find common parent directory of paths', () => {
  expect(findCommonDirPath(['test/a', 'test/b/a'])).toBe('test')
  expect(findCommonDirPath(['/test/a', '/test/b/a'])).toBe('/test')
  expect(findCommonDirPath(['/test/a/b', '/test/a/b/c'])).toBe('/test/a')
  expect(findCommonDirPath(['test/a/b', 'test/a/b', 'test/b/c', 'test/b/a'])).toBe('test')
})
