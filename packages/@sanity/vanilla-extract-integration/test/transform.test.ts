import {runInNewContext} from 'node:vm'
import {describe, expect, test} from 'vitest'
import {resolveScopedPackageName, transform} from '../src/transform.ts'

const rootPath = '/root'
const filePath = '/root/src/styles.css.ts'
const packageName = 'test-pkg'

function readFileScopeArgs(source: string): [string, string] {
  const match = source.match(/setFileScope\((.*)\)/)
  if (!match?.[1]) throw new Error(`no setFileScope call in:\n${source}`)
  return runInNewContext(`[${match[1]}]`) as [string, string]
}

describe('transform', () => {
  test('wraps ESM sources with an ESM file scope', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const one = style({});`

    const result = await transform({source, filePath, rootPath, packageName, identOption: 'short'})

    // The file scope carries the version- and content-salted package name (SAPP-4639), not
    // the bare package name
    const scopedPackageName = resolveScopedPackageName(packageName, undefined, source)
    expect(scopedPackageName).toMatch(/^test-pkg#[0-9a-f]{8}$/)
    expect(result)
      .toBe(`import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope("src/styles.css.ts", ${JSON.stringify(scopedPackageName)});
import { style } from '@vanilla-extract/css';
export const one = style({});
endFileScope();`)
  })

  test('wraps CJS sources with a require file scope', async () => {
    const source = `const { style } = require('@vanilla-extract/css');
module.exports = style({});`

    const result = await transform({source, filePath, rootPath, packageName, identOption: 'short'})

    const scopedPackageName = resolveScopedPackageName(packageName, undefined, source)
    expect(result).toBe(`const __vanilla_filescope__ = require("@vanilla-extract/css/fileScope");
__vanilla_filescope__.setFileScope("src/styles.css.ts", ${JSON.stringify(scopedPackageName)});
const { style } = require('@vanilla-extract/css');
module.exports = style({});
__vanilla_filescope__.endFileScope();`)
  })

  test('rewrites the arguments of an existing setFileScope call', async () => {
    const source = `import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope("previous/path.css.ts", "previous-pkg");
export const one = 1;
endFileScope();`

    const result = await transform({source, filePath, rootPath, packageName, identOption: 'short'})

    const [scopePath, scopePackage] = readFileScopeArgs(result)
    expect(scopePath).toBe('src/styles.css.ts')
    expect(scopePackage).toBe(resolveScopedPackageName(packageName, undefined, source))
    expect(result).not.toContain('previous/path.css.ts')
    // The source is not double-wrapped
    expect(result.match(/setFileScope\(/g)).toHaveLength(1)
  })

  test('injects debug IDs before wrapping when identOption is debug', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const box = style({});`

    const result = await transform({source, filePath, rootPath, packageName, identOption: 'debug'})

    expect(result).toContain(`style({}, "box")`)
    const [scopePath, scopePackage] = readFileScopeArgs(result)
    expect(scopePath).toBe('src/styles.css.ts')
    expect(scopePackage).toBe(resolveScopedPackageName(packageName, undefined, source))
  })

  test('does not inject debug IDs when identOption is short', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const box = style({});`

    const result = await transform({source, filePath, rootPath, packageName, identOption: 'short'})

    expect(result).toContain('style({})')
    expect(result).not.toContain('"box"')
  })

  test('binds a global adapter around the module when requested', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const one = style({});`

    const result = await transform({
      source,
      filePath,
      rootPath,
      packageName,
      identOption: 'short',
      globalAdapterIdentifier: 'globalThis["__adapter__"]',
    })

    const scopedPackageName = resolveScopedPackageName(packageName, undefined, source)
    expect(result).toBe(`import * as __vanilla_css_adapter__ from "@vanilla-extract/css/adapter";
__vanilla_css_adapter__.setAdapter(globalThis["__adapter__"]);
import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope("src/styles.css.ts", ${JSON.stringify(scopedPackageName)});
import { style } from '@vanilla-extract/css';
export const one = style({});
endFileScope();
__vanilla_css_adapter__.removeAdapter();`)
  })

  test('salts short and debug builds of the same module identically', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const box = style({});`

    // The salt is computed from the authored source, before debug IDs are injected, so the
    // `short` and `debug` file-scope hashes of a module match (as they did before salting)
    const [short, debug] = await Promise.all([
      transform({source, filePath, rootPath, packageName, identOption: 'short'}),
      transform({source, filePath, rootPath, packageName, identOption: 'debug'}),
    ])
    expect(readFileScopeArgs(short)[1]).toBe(readFileScopeArgs(debug)[1])
  })
})

describe('resolveScopedPackageName', () => {
  test('qualifies the package name with the version and the content hash', () => {
    // md5('hello') is 5d41402abc…, so the algorithm, hash length, and format are pinned
    expect(resolveScopedPackageName('test-pkg', '1.2.3', 'hello')).toBe('test-pkg@1.2.3#5d41402a')
  })

  test('omits the version qualifier when no version is known', () => {
    expect(resolveScopedPackageName('test-pkg', undefined, 'hello')).toBe('test-pkg#5d41402a')
  })

  test('is deterministic for identical input', () => {
    const source = `import { style } from '@vanilla-extract/css';`
    expect(resolveScopedPackageName('test-pkg', '1.2.3', source)).toBe(
      resolveScopedPackageName('test-pkg', '1.2.3', source),
    )
  })

  test('differs across versions for identical content', () => {
    const source = `import { style } from '@vanilla-extract/css';`
    expect(resolveScopedPackageName('test-pkg', '1.2.3', source)).not.toBe(
      resolveScopedPackageName('test-pkg', '1.2.4', source),
    )
  })

  test('differs across content for the same version', () => {
    expect(resolveScopedPackageName('test-pkg', '1.2.3', 'const a = 1;')).not.toBe(
      resolveScopedPackageName('test-pkg', '1.2.3', 'const a = 2;'),
    )
  })

  test('scopes CRLF and LF checkouts of the same file identically', () => {
    expect(resolveScopedPackageName('test-pkg', '1.2.3', 'a\r\nb\r\n')).toBe(
      resolveScopedPackageName('test-pkg', '1.2.3', 'a\nb\n'),
    )
  })
})
