import {describe, expect, test} from 'vitest'
import {transform} from '../src/transform.ts'

const rootPath = '/root'
const filePath = '/root/src/styles.css.ts'
const packageName = 'test-pkg'

describe('transform', () => {
  test('wraps ESM sources with an ESM file scope', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const one = style({});`

    const result = await transform({source, filePath, rootPath, packageName, identOption: 'short'})

    expect(result)
      .toBe(`import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope("src/styles.css.ts", "test-pkg");
import { style } from '@vanilla-extract/css';
export const one = style({});
endFileScope();`)
  })

  test('wraps CJS sources with a require file scope', async () => {
    const source = `const { style } = require('@vanilla-extract/css');
module.exports = style({});`

    const result = await transform({source, filePath, rootPath, packageName, identOption: 'short'})

    expect(result).toBe(`const __vanilla_filescope__ = require("@vanilla-extract/css/fileScope");
__vanilla_filescope__.setFileScope("src/styles.css.ts", "test-pkg");
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

    expect(result).toContain(`setFileScope("src/styles.css.ts", "test-pkg")`)
    expect(result).not.toContain('previous/path.css.ts')
    // The source is not double-wrapped
    expect(result.match(/setFileScope\(/g)).toHaveLength(1)
  })

  test('injects debug IDs before wrapping when identOption is debug', async () => {
    const source = `import { style } from '@vanilla-extract/css';
export const box = style({});`

    const result = await transform({source, filePath, rootPath, packageName, identOption: 'debug'})

    expect(result).toContain(`style({}, "box")`)
    expect(result).toContain(`setFileScope("src/styles.css.ts", "test-pkg")`)
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

    expect(result).toBe(`import * as __vanilla_css_adapter__ from "@vanilla-extract/css/adapter";
__vanilla_css_adapter__.setAdapter(globalThis["__adapter__"]);
import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";
setFileScope("src/styles.css.ts", "test-pkg");
import { style } from '@vanilla-extract/css';
export const one = style({});
endFileScope();
__vanilla_css_adapter__.removeAdapter();`)
  })
})
