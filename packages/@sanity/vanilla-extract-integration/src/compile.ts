/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * esbuild child compilation replaced by rolldown: the `vanilla-extract-filescope` esbuild
 * `onLoad` plugin becomes a rolldown `transform` hook with a native hook filter, and the
 * bundle is generated in-memory as CommonJS for {@link processVanillaFile}'s CJS sandbox.
 *
 * The upstream `esbuildOptions` passthrough is intentionally dropped: it leaked the esbuild API
 * into the public surface, and no consumer in this repository ever passed it.
 */
import {cssFileFilter} from './filters.ts'
import {getPackageInfo} from './packageInfo.ts'
import {transform} from './transform.ts'
import type {IdentifierOption} from './types.ts'

/** @public */
export interface CompileOptions {
  filePath: string
  identOption: IdentifierOption
  cwd?: string
}

/**
 * Bundles a single `.css.ts` module (and its local dependency graph) into evaluatable CommonJS
 * with a rolldown child compilation, wrapping every vanilla-extract module with its file scope
 * along the way. `@vanilla-extract/*` imports stay external so the evaluated code binds to the
 * same instances the project resolves.
 *
 * rolldown is lazy-loaded so the native binding only loads once a file is actually compiled.
 * @public
 */
export async function compile({
  filePath,
  identOption,
  cwd = process.cwd(),
}: CompileOptions): Promise<{source: string; watchFiles: string[]}> {
  const {rolldown} = await import('rolldown')
  const packageInfo = getPackageInfo(cwd)

  // Every module bundled into the compilation, collected at buildEnd — the equivalent of
  // upstream's esbuild `metafile.inputs`, which also listed transitively bundled plain modules
  let moduleIds: string[] = []

  const bundle = await rolldown({
    input: [filePath],
    cwd,
    platform: 'node',
    external: [/^@vanilla-extract($|\/)/],
    logLevel: 'silent',
    plugins: [
      {
        name: 'vanilla-extract-filescope',
        transform: {
          filter: {id: cssFileFilter},
          handler(code, id) {
            const [validId = id] = id.split('?')
            return transform({
              source: code,
              filePath: validId,
              rootPath: cwd,
              packageName: packageInfo.name,
              identOption,
            })
          },
        },
        buildEnd() {
          moduleIds = Array.from(this.getModuleIds())
        },
      },
    ],
  })

  try {
    const {output} = await bundle.generate({
      format: 'cjs',
      exports: 'named',
      // Inline dynamic imports so the whole graph evaluates in one synchronous CJS module,
      // like upstream's non-splitting esbuild bundle
      codeSplitting: false,
      sourcemap: false,
    })

    const entryChunk = output.find(
      (chunkOrAsset) => chunkOrAsset.type === 'chunk' && chunkOrAsset.isEntry,
    )

    if (!entryChunk || entryChunk.type !== 'chunk') {
      throw new Error('Invalid child compilation')
    }

    return {
      source: entryChunk.code,
      // Virtual modules (`\0`-prefixed plugin ids) aren't watchable files
      watchFiles: moduleIds.filter((id) => !id.startsWith('\0')),
    }
  } finally {
    await bundle.close()
  }
}
