import {describe, expect, test} from 'vitest'
import {cssFileFilter, isVanillaExtractSource} from '../src/filters.ts'

describe('cssFileFilter', () => {
  test('matches vanilla-extract module extensions', () => {
    expect(cssFileFilter.test('/app/styles.css.ts')).toBe(true)
    expect(cssFileFilter.test('/app/styles.css.js')).toBe(true)
    expect(cssFileFilter.test('/app/styles.css.js?used')).toBe(true)
    expect(cssFileFilter.test('/app/styles.ts')).toBe(false)
  })
})

describe('isVanillaExtractSource', () => {
  test('detects @vanilla-extract imports', () => {
    expect(
      isVanillaExtractSource(`import {style} from '@vanilla-extract/css'\nexport const box = style({})`),
    ).toBe(true)
    expect(
      isVanillaExtractSource(
        `import {setFileScope} from '@vanilla-extract/css/fileScope'\nsetFileScope('x')`,
      ),
    ).toBe(true)
    expect(
      isVanillaExtractSource(`const {recipe} = require('@vanilla-extract/recipes')`),
    ).toBe(true)
  })

  test('rejects plain Styles.css.js modules that only match by filename', () => {
    // Mirrors @bynder/compact-view's Styles.css.js — a CSS string export, not VE
    expect(
      isVanillaExtractSource(
        `const e = '.plain-css-js-dependency{color:rgb(201, 202, 203)}'\nexport {e as default}`,
      ),
    ).toBe(false)
    expect(isVanillaExtractSource(`export default ".foo{color:red}"`)).toBe(false)
  })
})
