import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown, type OutputChunk, type Plugin} from 'rolldown'
import {describe, expect, test} from 'vitest'
import {reactCompilerSurfacesPlugin} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureEntry = path.resolve(__dirname, 'fixtures/library/src/index.tsx')

/**
 * The fixture imports `sanity` and `@portabletext/react` for their define helpers and types —
 * neither needs to resolve to bundle it (the type import is erased, and `defineType` stays
 * external).
 */
const externals: Plugin = {
  name: 'test-externals',
  resolveId(id) {
    if (id === 'sanity' || id === '@portabletext/react' || id.startsWith('react')) {
      return {id, external: true}
    }
    return undefined
  },
}

async function buildFixture(plugins: Plugin[]): Promise<string> {
  const bundle = await rolldown({
    input: fixtureEntry,
    plugins: [externals, ...plugins],
  })
  try {
    const {output} = await bundle.generate({format: 'es'})
    const entry = output.find(
      (assetOrChunk): assetOrChunk is OutputChunk =>
        assetOrChunk.type === 'chunk' && assetOrChunk.isEntry,
    )
    if (!entry) expect.unreachable('expected an entry chunk')
    return entry.code
  } finally {
    await bundle.close()
  }
}

describe('reactCompilerSurfacesPlugin', () => {
  test('annotates surface functions with use memo directives', async () => {
    const code = await buildFixture([reactCompilerSurfacesPlugin()])

    // Both the PortableText mark component and the schema input slot carry the opt-in
    expect(code.match(/(["'])use memo\1/g)).toHaveLength(2)
  })

  test('compiles the annotated functions when chained before the React Compiler', async () => {
    const [{default: pluginBabel}, {reactCompilerPreset}] = await Promise.all([
      import('@rolldown/plugin-babel'),
      import('@vitejs/plugin-react'),
    ])
    // The same pipeline as @sanity/tsdown-config's `reactCompiler` option, with the surfaces
    // plugin in front — the compiler memoizes the annotated object-property functions in place
    const code = await buildFixture([
      reactCompilerSurfacesPlugin(),
      await pluginBabel({presets: [reactCompilerPreset({target: '19'})]}),
    ])

    expect(code).toContain('react/compiler-runtime')
    // The `marks.link` component got a memo cache keyed on its props
    expect(code).toMatch(/\$\[\d\] !== value\.href/)

    // Without the surfaces plugin the compiler finds nothing to memoize
    const withoutSurfaces = await buildFixture([
      await pluginBabel({presets: [reactCompilerPreset({target: '19'})]}),
    ])
    expect(withoutSurfaces).not.toContain('react/compiler-runtime')
  })
})
