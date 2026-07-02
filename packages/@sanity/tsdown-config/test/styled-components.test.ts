import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/styled-components-library')

function getStyledComponentsTransform(config: UserConfig) {
  const {inputOptions} = config
  if (!inputOptions || typeof inputOptions === 'function') return undefined
  return inputOptions.transform?.plugins?.styledComponents
}

describe('styledComponents option', () => {
  test('is disabled by default', () => {
    expect(getStyledComponentsTransform(defineConfig())).toBeUndefined()
    expect(getStyledComponentsTransform(defineConfig({styledComponents: false}))).toBeUndefined()
    expect(defineConfig().treeshake).toBeUndefined()
  })

  test('applies the same defaults as `babel: {styledComponents: true}` in @sanity/pkg-utils', () => {
    expect(getStyledComponentsTransform(defineConfig({styledComponents: true}))).toEqual({
      fileName: false,
      transpileTemplateLiterals: false,
      pure: true,
      cssProp: false,
    })
  })

  test('merges user provided options with the defaults', () => {
    expect(
      getStyledComponentsTransform(
        defineConfig({styledComponents: {namespace: 'my-lib', fileName: true}}),
      ),
    ).toEqual({
      fileName: true,
      transpileTemplateLiterals: false,
      pure: true,
      cssProp: false,
      namespace: 'my-lib',
    })
  })

  test('treats `styled` as side effect free so unused styled components are tree-shaken', () => {
    // oxc can't add `@__PURE__` annotations to tagged template expressions
    // (https://github.com/rollup/rollup/issues/4035), so `treeshake.manualPureFunctions`
    // handles tree-shaking of unused styled components instead
    expect(defineConfig({styledComponents: true}).treeshake).toEqual({
      manualPureFunctions: ['styled'],
    })
    // Opting out of `pure` also opts out of `manualPureFunctions`
    expect(defineConfig({styledComponents: {pure: false}}).treeshake).toBeUndefined()
  })
})

describe('styled-components-library', () => {
  test('transforms styled-components in esm and cjs output', async () => {
    const [distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])

    for (const output of [distIndexJs, distIndexCjs]) {
      // `displayName` improves debugging, `componentId` avoids SSR hydration mismatches,
      // both are added by the transform just like `babel-plugin-styled-components` does
      expect(output).toContain('displayName: "StyledButton"')
      expect(output).toMatch(/componentId: "sc-/)
      // The CSS inside the tagged template literal is minified
      expect(output).toContain('`cursor:pointer;border-radius:2px;padding:0;`')
      // Styled components that aren't exported from the package entry are tree-shaken
      expect(output).not.toContain('UnusedButton')
      expect(output).not.toContain('appearance:none')
    }
  })
})
