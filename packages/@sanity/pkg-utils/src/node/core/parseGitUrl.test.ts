import {expect, test} from 'vitest'
import {parseGitUrl} from './parseGitUrl.ts'

test('parses common git remote URL forms', () => {
  const expected = {source: 'github.com', owner: 'sanity-io', name: 'pkg-utils'}

  expect(parseGitUrl('https://github.com/sanity-io/pkg-utils')).toEqual(expected)
  expect(parseGitUrl('https://github.com/sanity-io/pkg-utils.git')).toEqual(expected)
  expect(parseGitUrl('git@github.com:sanity-io/pkg-utils.git')).toEqual(expected)
  expect(parseGitUrl('ssh://git@github.com/sanity-io/pkg-utils.git')).toEqual(expected)
  expect(parseGitUrl('git+ssh://git@github.com/sanity-io/pkg-utils.git')).toEqual(expected)
})

test('parses nested owner paths (e.g. GitLab subgroups)', () => {
  expect(parseGitUrl('https://gitlab.com/group/subgroup/repo')).toEqual({
    source: 'gitlab.com',
    owner: 'group/subgroup',
    name: 'repo',
  })
})

test('throws on invalid URLs', () => {
  expect(() => parseGitUrl('')).toThrow('Invalid url.')
  expect(() => parseGitUrl('not a url')).toThrow('URL parsing failed.')
  expect(() => parseGitUrl('http://example.com')).toThrow('URL parsing failed.')
})
