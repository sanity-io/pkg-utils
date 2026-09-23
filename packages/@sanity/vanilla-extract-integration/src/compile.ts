/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * esbuild child compilation replaced by rolldown: the `vanilla-extract-filescope` esbuild
 * `onLoad` plugin becomes a rolldown `transform` hook with a native hook filter, and the
 * bundle is generated in-memory as CommonJS for {@link processVanillaFile}'s CJS sandbox.
 *
 * The upstream `esbuildOptions` passthrough is intentionally dropped: it leaked the esbuild API
 * into the public surface, and no consumer in this repository ever passed it.
 *
 * {@link compileProgram} is this fork's addition: the same child compilation over a synthetic
 * entry that re-exports every `.css.ts` module of a project as a namespace, so the whole graph is
 * bundled (scope-hoisted, with colliding bindings deconflicted by rolldown) and evaluated once.
 */
import path from 'node:path'
import type {Plugin} from 'rolldown'
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

/** @public */
export interface CompileProgramOptions {
  /** Absolute paths of the `.css.ts` modules to bundle together. */
  filePaths: ReadonlyArray<string>
  identOption: IdentifierOption
  cwd?: string
}

/** @public */
export interface CompiledProgram {
  /** The compiled CommonJS source; its exports are the module namespaces, see `namespaces`. */
  source: string
  /** The export name of each module's namespace on the compiled source, by file path. */
  namespaces: ReadonlyMap<string, string>
  watchFiles: string[]
}

/** The id of the synthetic entry {@link compileProgram} bundles. */
const PROGRAM_ENTRY_ID = '\0vanilla-extract-program'

async function runChildCompilation({
  input,
  cwd,
  identOption,
  plugins = [],
}: {
  input: string
  cwd: string
  identOption: IdentifierOption
  plugins?: Plugin[]
}): Promise<{source: string; watchFiles: string[]}> {
  const {rolldown} = await import('rolldown')
  const packageInfo = getPackageInfo(cwd)

  // Every module bundled into the compilation, collected at buildEnd — the equivalent of
  // upstream's esbuild `metafile.inputs`, which also listed transitively bundled plain modules
  let moduleIds: string[] = []

  const bundle = await rolldown({
    input: [input],
    cwd,
    platform: 'node',
    external: [/^@vanilla-extract($|\/)/],
    logLevel: 'silent',
    plugins: [
      ...plugins,
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
  return runChildCompilation({input: filePath, cwd, identOption})
}

/**
 * Bundles a whole set of `.css.ts` modules (and their local dependency graphs) into one
 * evaluatable CommonJS module through a synthetic entry that re-exports each module as a
 * namespace (`export * as m0 from '/abs/foo.css.ts'`). Modules shared between them are bundled
 * and evaluated once, and rolldown's scope hoisting renames colliding bindings.
 * @public
 */
export async function compileProgram({
  filePaths,
  identOption,
  cwd = process.cwd(),
}: CompileProgramOptions): Promise<CompiledProgram> {
  const namespaces = new Map<string, string>()
  const entryLines: string[] = []

  const resolvedFilePaths = new Set(filePaths.map((filePath) => path.resolve(cwd, filePath)))
  for (const [index, filePath] of Array.from(resolvedFilePaths).entries()) {
    const namespace = `m${index}`
    namespaces.set(filePath, namespace)
    entryLines.push(`export * as ${namespace} from ${JSON.stringify(filePath)};`)
  }

  const {source, watchFiles} = await runChildCompilation({
    input: PROGRAM_ENTRY_ID,
    cwd,
    identOption,
    plugins: [
      {
        name: 'vanilla-extract-program-entry',
        resolveId: {
          filter: {id: /^\0vanilla-extract-program$/},
          handler(id) {
            return id === PROGRAM_ENTRY_ID ? id : undefined
          },
        },
        load: {
          filter: {id: /^\0vanilla-extract-program$/},
          handler(id) {
            return id === PROGRAM_ENTRY_ID
              ? {code: entryLines.join('\n'), moduleType: 'js'}
              : undefined
          },
        },
      },
    ],
  })

  return {source, namespaces, watchFiles}
}
