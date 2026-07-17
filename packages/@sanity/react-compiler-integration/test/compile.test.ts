/**
 * End-to-end proof that the annotation makes `babel-plugin-react-compiler` compile functions
 * its `infer` mode never sees: the annotated output is piped through the real compiler, and
 * the compiled components render byte-identical markup to their uncompiled originals.
 */
import {createRequire} from 'node:module'
import vm from 'node:vm'
import {transformSync} from '@babel/core'
import {describe, expect, test} from 'vitest'
import {annotateReactCompilerSurfaces} from '../src/index.ts'

const require = createRequire(import.meta.url)

/** Compiles a module with the real `babel-plugin-react-compiler` (and nothing else). */
function compileWithReactCompiler(source: string, filename: string): string {
  const result = transformSync(source, {
    filename,
    parserOpts: {plugins: ['jsx']},
    plugins: [['babel-plugin-react-compiler', {}]],
    configFile: false,
    babelrc: false,
  })
  if (!result?.code) throw new Error('babel produced no output')
  return result.code
}

/**
 * Compiles a module to CommonJS (through the React Compiler) and evaluates it with a stubbed
 * `sanity` module, returning its exports.
 */
function evaluateWithReactCompiler(source: string, filename: string): Record<string, unknown> {
  const result = transformSync(source, {
    filename,
    plugins: [['babel-plugin-react-compiler', {}], '@babel/plugin-transform-modules-commonjs'],
    configFile: false,
    babelrc: false,
  })
  if (!result?.code) throw new Error('babel produced no output')

  const moduleShim = {exports: {} as Record<string, unknown>}
  const requireShim = (id: string): unknown => {
    if (id === 'sanity') return {defineConfig: (config: unknown) => config}
    return require(id)
  }
  vm.runInNewContext(result.code, {
    require: requireShim,
    module: moduleShim,
    exports: moduleShim.exports,
    process,
  })
  return moduleShim.exports
}

describe('babel-plugin-react-compiler integration', () => {
  test('infer mode skips object-property functions without the annotation', async () => {
    const source = `
import {defineConfig} from 'sanity'

export default defineConfig({
  form: {
    components: {
      input: (props) =>
        props.schemaType?.name === 'string' ? <CustomStringInput {...props} /> : props.renderDefault(props),
    },
  },
})
`
    // Without the annotation the compiler leaves the module untouched…
    expect(compileWithReactCompiler(source, 'sanity.config.jsx')).not.toContain(
      'react/compiler-runtime',
    )

    // …but the annotated module compiles in place, memo cache and all
    const annotated = await annotateReactCompilerSurfaces(source, {
      filename: 'sanity.config.jsx',
    })
    const compiled = compileWithReactCompiler(annotated!.code, 'sanity.config.jsx')
    expect(compiled).toContain('react/compiler-runtime')
    expect(compiled).toMatch(/\$ = _c\(\d+\)/)
  })

  test('compiles annotated hook props as hooks', async () => {
    const source = `
import {defineConfig} from 'sanity'
import {useMemo} from 'react'

export default defineConfig({
  fieldActions: {
    useFieldActions: (props) => {
      const getUserInput = useUserInput()
      return useMemo(() => [getUserInput], [getUserInput])
    },
  },
})
`
    const annotated = await annotateReactCompilerSurfaces(source, {
      filename: 'sanity.config.jsx',
    })
    const compiled = compileWithReactCompiler(annotated!.code, 'sanity.config.jsx')
    expect(compiled).toContain('react/compiler-runtime')
    // The `useMemo(…, [getUserInput])` is replaced by compiler memo-cache slots
    expect(compiled).toMatch(/\$\[0\] !== getUserInput/)
  })

  test('compiled components render identical markup', async () => {
    const source = `
import {createElement} from 'react'
import {defineConfig} from 'sanity'

export default defineConfig({
  form: {
    components: {
      input: (props) => {
        const rel = !props.href.startsWith('/') ? 'noreferrer noopener' : undefined
        return createElement('a', {href: props.href, rel}, props.label)
      },
    },
  },
})
`
    const annotated = await annotateReactCompilerSurfaces(source, {
      filename: 'sanity.config.js',
    })
    expect(annotated).not.toBeNull()

    type Config = {form: {components: {input: React.ComponentType<Record<string, unknown>>}}}
    const original = evaluateWithReactCompiler(source, 'sanity.config.js')
      .default as unknown as Config
    const compiled = evaluateWithReactCompiler(annotated!.code, 'sanity.config.js')
      .default as unknown as Config

    const {createElement} = require('react') as typeof import('react')
    const {renderToStaticMarkup} = require('react-dom/server') as typeof import('react-dom/server')

    const props = {href: 'https://sanity.io', label: 'Sanity'}
    const originalHtml = renderToStaticMarkup(createElement(original.form.components.input, props))
    const compiledHtml = renderToStaticMarkup(createElement(compiled.form.components.input, props))

    expect(compiledHtml).toBe(originalHtml)
    expect(originalHtml).toBe('<a href="https://sanity.io" rel="noreferrer noopener">Sanity</a>')
  })
})
