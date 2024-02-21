import alias from '@rollup/plugin-alias'
import {getBabelOutputPlugin} from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import {nodeResolve} from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import path from 'path'
import {InputOptions, OutputOptions, Plugin} from 'rollup'
import esbuild from 'rollup-plugin-esbuild'

import {BuildContext, resolveConfigProperty} from '../../core'
import {RollupTask, RollupWatchTask} from '../types'

export interface RollupConfig {
  inputOptions: InputOptions
  outputOptions: OutputOptions
}

/** @internal */
export function resolveRollupConfig(
  ctx: BuildContext,
  buildTask: RollupTask | RollupWatchTask,
): RollupConfig {
  const {format, runtime, target} = buildTask
  const {config, cwd, exports: _exports, extMap, external, distPath, logger, pkg, ts} = ctx
  const outputExt = extMap[pkg.type || 'commonjs'][format]
  const minify = config?.minify ?? false
  const outDir = path.relative(cwd, distPath)

  const pathAliases = Object.fromEntries(
    Object.entries(ts.config?.options.paths || {}).map(([key, val]) => {
      return [key, path.resolve(cwd, ts.config?.options.baseUrl || '.', val[0])]
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

  const defaultPlugins = [
    replace({
      preventAssignment: true,
      values: {
        ...(pkg.name === '@sanity/pkg-utils'
          ? {...replacements}
          : {
              'process.env.PKG_FILE_PATH': (arg) => {
                const sourcePath = './' + path.relative(cwd, arg)
                const entry = entries.find((e) => e.source === sourcePath)

                if (!entry) {
                  // eslint-disable-next-line no-console
                  console.error(`could not find source entry: ${sourcePath}`)

                  return 'null'
                }

                return JSON.stringify(
                  path.relative(cwd, path.resolve(outDir, entry.name + outputExt)),
                )
              },
              'process.env.PKG_FORMAT': JSON.stringify(format),
              'process.env.PKG_RUNTIME': JSON.stringify(runtime),
              'process.env.PKG_VERSION': JSON.stringify(process.env.PKG_VERSION || pkg.version),
              ...replacements,
            }),
      },
    }),
    alias({
      entries: {...pathAliases},
    }),
    nodeResolve({
      // mainFields: ['module', 'jsnext', 'main'],
      browser: runtime === 'browser',
      // exportConditions: [runtime === 'node' ? 'node' : 'browser'],
      extensions: ['.cjs', '.mjs', '.js', '.jsx', '.json', '.node'],
      preferBuiltins: true, // runtime === 'node',
    }),
    commonjs(),
    json(),
    esbuild({
      jsx: config?.jsx ?? 'automatic',
      jsxFactory: config?.jsxFactory ?? 'createElement',
      jsxFragment: config?.jsxFragment ?? 'Fragment',
      jsxImportSource: config?.jsxImportSource ?? 'react',
      target,
      tsconfig: ctx.ts.configPath || 'tsconfig.json',
      treeShaking: true,
      minifySyntax: config?.minify !== false,
      supported: {
        'template-literal': true,
      },
    }),
    Array.isArray(config?.babel?.plugins) &&
      getBabelOutputPlugin({
        babelrc: false,
        plugins: config?.babel?.plugins,
      }),
    minify &&
      terser({
        compress: {directives: false},
        output: {
          comments: (_node, comment) => {
            const text = comment.value
            const type = comment.type

            // Check if this is a multiline comment
            if (type === 'comment2') {
              // Keep licensing comments
              return /@preserve|@license|@cc_on/i.test(text)
            }

            return false
          },
        },
      }),
  ].filter(Boolean) as Plugin[]

  const userPlugins = config?.rollup?.plugins

  const plugins = Array.isArray(userPlugins)
    ? defaultPlugins.concat(userPlugins)
    : resolveConfigProperty(config?.rollup?.plugins, defaultPlugins)

  return {
    inputOptions: {
      context: cwd,

      external: (id, importer) => {
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

        const idParts = id.split('/')

        const name = idParts[0].startsWith('@') ? `${idParts[0]}/${idParts[1]}` : idParts[0]

        if (name && external.includes(name)) {
          return true
        }

        return false
      },

      input: entries.reduce<{[entryAlias: string]: string}>((acc, entry) => {
        return {...acc, [entry.name]: entry.source}
      }, {}),

      watch: {
        chokidar: {
          usePolling: true,
        },
      },

      plugins,

      treeshake: {
        preset: 'recommended',
        propertyReadSideEffects: false,
        ...config?.rollup?.treeshake,
      },
      experimentalLogSideEffects: config?.rollup?.experimentalLogSideEffects,
    },
    outputOptions: {
      chunkFileNames: () => {
        const parts = outputExt.split('.')

        if (parts.length === 3) {
          return `_chunks/[name]-[hash].${parts[2]}`
        }

        return `_chunks/[name]-[hash]${outputExt}`
      },
      compact: minify,
      dir: outDir,
      entryFileNames: () => {
        const parts = outputExt.split('.')

        if (parts.length === 3) {
          return `[name].${parts[2]}`
        }

        return `[name]${outputExt}`
      },
      esModule: true,
      format,
      interop: 'compat',
      minifyInternalExports: minify,
      sourcemap: config?.sourcemap ?? true,
      hoistTransitiveImports: false,
      ...config?.rollup?.output,
    },
  }
}
