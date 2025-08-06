import path from 'node:path'
import type {InputOptions, OutputOptions} from 'rolldown'
import {dts as dtsPlugin} from 'rolldown-plugin-dts'
import type {BuildContext} from '../../core/contexts/buildContext'
import {pkgExtMap as extMap} from '../../core/pkg/pkgExt'
import type {RolldownDtsTask} from '../types'

export interface RolldownConfig {
  inputOptions: InputOptions
  outputOptions: OutputOptions
}

export function resolveRolldownConfig(
  ctx: BuildContext,
  buildTask: RolldownDtsTask,
): RolldownConfig {
  const {format, runtime} = buildTask
  const {config, cwd, exports: _exports, external, distPath, logger, pkg, ts} = ctx
  const outputExt = extMap[pkg.type || 'commonjs'][format]
  const outDir = path.relative(cwd, distPath)

  const pathAliases = Object.fromEntries(
    Object.entries(ts.config?.options.paths || {}).map(([key, val]) => {
      return [key, path.resolve(cwd, ts.config?.options.baseUrl || '.', val[0]!)]
    }),
  )

  const entries = buildTask.entries.map((entry) => {
    return {
      ...entry,
      name: path.relative(outDir, entry.output).replace(/\.[^/.]+$/, ''),
    }
  }, {})

  const exportIds =
    _exports && Object.keys(_exports).map((exportPath) => path.join(pkg.name, exportPath))

  const sourcePaths = _exports && Object.values(_exports).map((e) => path.resolve(cwd, e.source))

  const replacements = Object.fromEntries(
    Object.entries(config?.define || {}).map(([key, val]) => [key, JSON.stringify(val)]),
  )

  const entryFileNames = `[name]${outputExt}`

  const inputOptions = {
    cwd,
    jsx: {
      mode:
        config?.jsx === 'automatic'
          ? 'automatic'
          : config?.jsx === 'preserve'
            ? 'preserve'
            : config?.jsx === 'transform'
              ? 'classic'
              : 'automatic',
      factory: config?.jsxFactory,
      fragment: config?.jsxFragment,
      importSource: config?.jsxImportSource,
    },
    define:
      pkg.name === '@sanity/pkg-utils'
        ? {...replacements}
        : {
            'process.env.PKG_FORMAT': JSON.stringify(format),
            'process.env.PKG_RUNTIME': JSON.stringify(runtime),
            'process.env.PKG_VERSION': JSON.stringify(process.env['PKG_VERSION'] || pkg.version),
            ...replacements,
          },

    platform:
      buildTask.type === 'rolldown:dts'
        ? 'node'
        : runtime === 'node'
          ? 'node'
          : runtime === 'browser'
            ? 'browser'
            : 'neutral',

    resolve: {
      alias: pathAliases,
      tsconfigFilename: ctx.ts.configPath || 'tsconfig.json',
    },
    experimental: {
      attachDebugInfo: 'none',
    },

    external: (id, importer) => {
      if (
        buildTask.type === 'rolldown:dts' &&
        ctx.bundledPackages.length > 0 &&
        !id.startsWith('.') &&
        (id.includes('/node_modules/') || id.split('/').length < 3)
      ) {
        return (
          ctx.bundledPackages.some((name) => name === id || id.includes(`/${name}/`)) === false
        )
      }

      // Check if the id is a self-referencing import
      if (exportIds?.includes(id)) {
        return true
      }

      // Check if the id is a file path that points to an exported source file
      if (importer && (id.startsWith('.') || id.startsWith('/'))) {
        const idPath = path.resolve(path.dirname(importer), id)

        if (sourcePaths?.includes(idPath)) {
          logger.warn(
            `detected self-referencing import – treating as external: ${path.relative(
              cwd,
              idPath,
            )}`,
          )

          return true
        }
      }

      return external.some((name) => name === id || id.includes(`/node_modules/${name}/`))
    },

    input: entries.reduce<{[entryAlias: string]: string}>(
      (acc, entry) => Object.assign(acc, {[entry.name]: entry.source}),
      {},
    ),

    plugins: [
      dtsPlugin({
        emitDtsOnly: true,
        tsconfig: ctx.ts.configPath || 'tsconfig.json',
        tsgo:
          typeof pkg.devDependencies === 'object' &&
          '@typescript/native-preview' in pkg.devDependencies,
        // Enable the resolver by giving an allow list of packages to dig through node_modules.
        // If there are none that should be resolved, then this process is skipped and our build is faster.
        // If there's a match then it'll call the resolver function defined on `inputOptions.external`
        resolve: ctx.bundledPackages,
        // Always create dts from scratch, don't reuse contexts from previous builds
        newContext: true,
      }),
    ],

    treeshake: {
      moduleSideEffects: 'no-external',
      unknownGlobalSideEffects: false,
      annotations: true,
    },
  } satisfies InputOptions
  const outputOptions = {
    dir: outDir,
    entryFileNames,
    chunkFileNames:
      buildTask.type === 'rolldown:dts' ? `_chunks-dts/[name]${outputExt}` : undefined,
    esModule: true,
    format: buildTask.type === 'rolldown:dts' ? 'es' : format,
    sourcemap: buildTask.type === 'rolldown:dts' ? false : (config?.sourcemap ?? true),
    hoistTransitiveImports: false,
    /**
     * rolldown doesn't permit disabling chunks, we can only choose between automatic chunking (the default)
     * and manual chunking (using advancedChunks).
     * This matters for how we generate dts files.
     * While we use rolldown for dts generation, and rollup for the rest, we want to reduce the amount of dts files emitted as chunks,
     * and to make them predictable in how they're generated.
     */
    // @TODO the following breaks the dts generation, report bug to rolldown
    // advancedChunks:
    //   buildTask.type === 'rolldown:dts'
    //     ? {
    //         groups: [
    //           {
    //             /**
    //              * Groups all inlined typings specified by bundledPackages in extract.bundledPackages to its own chunk.
    //              */
    //             name: 'bundled-packages',
    //             test: (id) => ctx.bundledPackages.includes(id),
    //             priority: 1,
    //           },
    //           {
    //             /**
    //              * Put all other shared chunks into a single chunk.
    //              */
    //             name: 'shared',
    //             minShareCount: 1,
    //           },
    //         ],
    //       }
    //     : {},
  } satisfies OutputOptions

  return {inputOptions, outputOptions}
}
