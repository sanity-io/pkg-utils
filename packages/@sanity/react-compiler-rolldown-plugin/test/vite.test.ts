import path from 'node:path'
import {fileURLToPath} from 'node:url'
import babel from '@rolldown/plugin-babel'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import {build, createServer, type InlineConfig, type Plugin, type Rollup} from 'vite'
import {describe, expect, test} from 'vitest'
import {reactCompilerSurfacesPlugin} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, 'fixtures/app')
const sanityStub = path.resolve(__dirname, 'fixtures/sanity-stub.ts')

/**
 * Mirrors how the Sanity CLI enables the React Compiler on Vite 8 (`reactCompiler` in
 * `sanity.cli.ts`): `@vitejs/plugin-react` plus a `@rolldown/plugin-babel` pass with the
 * `reactCompilerPreset` — with the surfaces plugin in front (it is `enforce: 'pre'`).
 */
function viteConfig(withSurfaces: boolean): InlineConfig {
  return {
    root: appRoot,
    configFile: false,
    logLevel: 'silent',
    resolve: {alias: {sanity: sanityStub}},
    plugins: [
      // The narrower rolldown plugin shape is runtime-compatible with Vite 8 (rolldown-vite),
      // but comparing it structurally against Vite's recursive `PluginOption` union blows
      // TypeScript's instantiation depth, so widen it to Vite's `Plugin` explicitly
      ...(withSurfaces ? [reactCompilerSurfacesPlugin() as Plugin] : []),
      react(),
      babel({presets: [reactCompilerPreset({target: '19'})]}),
    ],
  }
}

function findEntryChunk(output: readonly (Rollup.OutputAsset | Rollup.OutputChunk)[]): string {
  const chunk = output.find(
    (assetOrChunk): assetOrChunk is Rollup.OutputChunk =>
      assetOrChunk.type === 'chunk' && assetOrChunk.isEntry,
  )
  if (!chunk) expect.unreachable('expected an entry chunk')
  return chunk.code
}

async function buildApp(withSurfaces: boolean): Promise<string> {
  const result = await build({
    ...viteConfig(withSurfaces),
    build: {write: false, minify: false},
  })
  const {output} = Array.isArray(result) ? result[0]! : (result as Rollup.RollupOutput)
  return findEntryChunk(output)
}

describe('vite build', () => {
  test('the React Compiler memoizes the annotated config slots', async () => {
    const code = await buildApp(true)

    // The `form.components.input` arrow carries the injected opt-in and got a memo cache
    // keyed on its props (react is bundled, so assert on the compiled shape, not the
    // `react/compiler-runtime` specifier). `CustomStringInput` is a regular PascalCase
    // component the compiler finds on its own, so the directive-adjacent cache is the signal.
    expect(code).toMatch(/"use memo";\s*const \$ = /)
    expect(code).toMatch(/\$\[0\] !== props/)
  })

  test('without the plugin the compiler skips the config slots', async () => {
    const code = await buildApp(false)

    expect(code).not.toContain('"use memo"')
  })
})

describe('vite dev', () => {
  test('annotates and compiles during dev transforms', async () => {
    const server = await createServer({
      ...viteConfig(true),
      server: {middlewareMode: true},
      optimizeDeps: {noDiscovery: true},
    })
    try {
      const result = await server.transformRequest('/src/sanity.config.ts')
      // The injected opt-in made the compiler give the `input` slot a memo cache (vite
      // rewrites the `react/compiler-runtime` import specifier, so assert the compiled shape)
      expect(result?.code).toContain('use memo')
      expect(result?.code).toMatch(/\$ = _c\(\d+\)/)
      expect(result?.code).toMatch(/\$\[0\] !== props/)
    } finally {
      await server.close()
    }
  })
})
