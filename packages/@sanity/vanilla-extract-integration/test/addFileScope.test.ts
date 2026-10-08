import {runInNewContext} from 'node:vm'
import {describe, expect, test} from 'vitest'
import {addFileScope} from '../src/addFileScope.ts'

const rootPath = '/root'
/**
 * Quotes, a backslash (normalized to `/` in the path, kept in the package name), a newline,
 * a backtick, and `$` sequences that would break a raw `"${path}", "${packageName}"`
 * interpolation — and, on the rewrite site, `String#replace` patterns (`$&`, `$'`).
 */
const filePath = '/root/src/o\'brien/styles"quoted"\\$.css.ts'
const packageName = 'acme"widgets\\${`\n$&$\'$'
/** `normalizePath` rewrites the backslash before the arguments are escaped. */
const normalizedPath = 'src/o\'brien/styles"quoted"/$.css.ts'

function readFileScopeArgs(source: string): [string, string] {
  const match = source.match(/setFileScope\((.*)\)/)
  if (!match?.[1]) throw new Error(`no setFileScope call in:\n${source}`)
  return runInNewContext(`[${match[1]}]`) as [string, string]
}

describe('addFileScope', () => {
  test('escapes quotes and special characters when wrapping ESM', () => {
    const source = `import { style } from '@vanilla-extract/css';
export const one = style({});`

    const result = addFileScope({source, filePath, rootPath, packageName})

    expect(result)
      .toBe(`import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope(${JSON.stringify(normalizedPath)}, ${JSON.stringify(packageName)});
import { style } from '@vanilla-extract/css';
export const one = style({});
endFileScope();`)
    expect(readFileScopeArgs(result)).toEqual([normalizedPath, packageName])
  })

  test('escapes quotes and special characters when wrapping CJS', () => {
    const source = `const { style } = require('@vanilla-extract/css');
module.exports = style({});`

    const result = addFileScope({source, filePath, rootPath, packageName})

    expect(result).toBe(`const __vanilla_filescope__ = require("@vanilla-extract/css/fileScope");
__vanilla_filescope__.setFileScope(${JSON.stringify(normalizedPath)}, ${JSON.stringify(packageName)});
const { style } = require('@vanilla-extract/css');
module.exports = style({});
__vanilla_filescope__.endFileScope();`)
    expect(readFileScopeArgs(result)).toEqual([normalizedPath, packageName])
  })

  test('escapes quotes and special characters when rewriting an existing setFileScope call', () => {
    const source = `import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope("previous/path.css.ts", "previous-pkg");
export const one = 1;
endFileScope();`

    const result = addFileScope({source, filePath, rootPath, packageName})

    expect(result).toContain(
      `setFileScope(${JSON.stringify(normalizedPath)}, ${JSON.stringify(packageName)})`,
    )
    expect(result).not.toContain('previous/path.css.ts')
    expect(result).not.toContain('previous-pkg')
    expect(result.match(/setFileScope\(/g)).toHaveLength(1)
    expect(readFileScopeArgs(result)).toEqual([normalizedPath, packageName])
  })
})
