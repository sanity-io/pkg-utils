import {describe, expect, test} from 'vitest'
import {createFileScopePackageName} from '../src/fileScopePackageName.ts'
import {transform} from '../src/transform.ts'

const rootPath = '/root'
const filePath = '/root/src/styles.css.ts'
const packageName = 'test-pkg'
const packageVersion = '1.2.3'

/** The file scope's package name: `test-pkg@1.2.3+<digest of source>`. */
const scopeName = (source: string) =>
  createFileScopePackageName({name: packageName, version: packageVersion, source})

describe('transform', () => {
  test('wraps ESM sources with an ESM file scope', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const one = style({});`

    const result = await transform({
      source,
      filePath,
      rootPath,
      packageName,
      packageVersion,
      identOption: 'short',
    })

    expect(result)
      .toBe(`import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope("src/styles.css.ts", "${scopeName(source)}");
import { style } from '@vanilla-extract/css';
export const one = style({});
endFileScope();`)
  })

  test('wraps CJS sources with a require file scope', async () => {
    const source = `const { style } = require('@vanilla-extract/css');
module.exports = style({});`

    const result = await transform({
      source,
      filePath,
      rootPath,
      packageName,
      packageVersion,
      identOption: 'short',
    })

    expect(result).toBe(`const __vanilla_filescope__ = require("@vanilla-extract/css/fileScope");
__vanilla_filescope__.setFileScope("src/styles.css.ts", "${scopeName(source)}");
const { style } = require('@vanilla-extract/css');
module.exports = style({});
__vanilla_filescope__.endFileScope();`)
  })

  test('rewrites the arguments of an existing setFileScope call', async () => {
    const source = `import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope("previous/path.css.ts", "previous-pkg");
export const one = 1;
endFileScope();`

    const result = await transform({
      source,
      filePath,
      rootPath,
      packageName,
      packageVersion,
      identOption: 'short',
    })

    expect(result).toContain(`setFileScope("src/styles.css.ts", "${scopeName(source)}")`)
    expect(result).not.toContain('previous/path.css.ts')
    expect(result).not.toContain('previous-pkg')
    // The source is not double-wrapped
    expect(result.match(/setFileScope\(/g)).toHaveLength(1)
  })

  test('qualifies the file scope with the version and a digest of the source', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const one = style({});`
    const params = {source, filePath, rootPath, packageName, identOption: 'short' as const}

    const result = await transform({...params, packageVersion})
    const scope = /setFileScope\("src\/styles\.css\.ts", "([^"]+)"\)/.exec(result)?.[1]
    expect(scope).toMatch(/^test-pkg@1\.2\.3\+[0-9a-f]{8}$/)

    // Another version, or other styles, give the file scope another package name — and with
    // it other identifiers for the module's styles
    expect(await transform({...params, packageVersion: '1.2.4'})).not.toContain(`"${scope}"`)
    expect(
      await transform({...params, packageVersion, source: `${source}\nexport const two = 1;`}),
    ).not.toContain(`"${scope}"`)

    // A package without a version is scoped as 0.0.0
    expect(await transform(params)).toContain(
      `setFileScope("src/styles.css.ts", "${scopeName(source).replace('@1.2.3+', '@0.0.0+')}")`,
    )
  })

  test('injects debug IDs before wrapping when identOption is debug', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const box = style({});`

    const result = await transform({
      source,
      filePath,
      rootPath,
      packageName,
      packageVersion,
      identOption: 'debug',
    })

    expect(result).toContain(`style({}, "box")`)
    // The digest covers the authored source, not the debug-ID-injected code, so the file scope
    // (and the hash in the identifiers) is the same for every identifier option
    expect(result).toContain(`setFileScope("src/styles.css.ts", "${scopeName(source)}")`)
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
      packageVersion,
      identOption: 'short',
      globalAdapterIdentifier: 'globalThis["__adapter__"]',
    })

    expect(result).toBe(`import * as __vanilla_css_adapter__ from "@vanilla-extract/css/adapter";
__vanilla_css_adapter__.setAdapter(globalThis["__adapter__"]);
import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope("src/styles.css.ts", "${scopeName(source)}");
import { style } from '@vanilla-extract/css';
export const one = style({});
endFileScope();
__vanilla_css_adapter__.removeAdapter();`)
  })
})
