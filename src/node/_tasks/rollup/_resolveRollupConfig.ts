import path from 'path'
import alias from '@rollup/plugin-alias'
import {getBabelOutputPlugin} from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import {nodeResolve} from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import {InputOptions, OutputOptions} from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import {terser} from 'rollup-plugin-terser'
import {_BuildContext, _DEFAULTS} from '../../_core'
import {_RollupTask, _RollupWatchTask} from '../_types'

export interface _RollupConfig {
  inputOptions: InputOptions
  outputOptions: OutputOptions
}

/** @internal */
export function _resolveRollupConfig(
  ctx: _BuildContext,
  buildTask: _RollupTask | _RollupWatchTask
): _RollupConfig {
  const {format, runtime, target} = buildTask
  const {config, cwd, exports: _exports, external, dist: outDir, logger, pkg, ts} = ctx
  const outputExt = format === 'commonjs' ? '.cjs' : '.js'
  const minify = config?.minify ?? true

  const pathAliases = Object.fromEntries(
    Object.entries(ts.config?.options.paths || {}).map(([key, val]) => {
      return [key, path.resolve(cwd, ts.config?.options.baseUrl || '.', val[0])]
    })
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
                idPath
              )}`
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

      onwarn(warning, rollupWarn) {
        if (!warning.code || !['CIRCULAR_DEPENDENCY'].includes(warning.code)) {
          rollupWarn(warning)
        }
      },

      plugins: [
        replace({
          preventAssignment: true,
          values: {
            ...(pkg.name === '@sanity/pkg-utils'
              ? {}
              : {
                  'process.env.PKG_FILE_PATH': (arg) => {
                    const sourcePath = './' + path.relative(cwd, arg)
                    const entry = entries.find((e) => e.source === sourcePath)

                    if (!entry) {
                      throw new Error(`could not find source entry: ${sourcePath}`)
                    }

                    return JSON.stringify(
                      path.relative(cwd, path.resolve(outDir, entry.name + outputExt))
                    )
                  },
                  'process.env.PKG_FORMAT': JSON.stringify(format),
                  'process.env.PKG_RUNTIME': JSON.stringify(runtime),
                  'process.env.PKG_VERSION': JSON.stringify(process.env.PKG_VERSION || pkg.version),
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
        commonjs({
          esmExternals: false,
          extensions: ['.js'],
          // include: /\/node_modules\//,
          // requireReturnsDefault: 'namespace',
        }),
        json(),
        esbuild({
          jsx: config?.jsx ?? 'automatic',
          jsxFactory: config?.jsxFactory ?? 'createElement',
          jsxFragment: config?.jsxFragment ?? 'Fragment',
          jsxImportSource: config?.jsxImportSource ?? 'react',
          target,
          tsconfig: ctx.ts.configPath || 'tsconfig.json',
        }),
        getBabelOutputPlugin({
          babelrc: false,
          plugins: ['@babel/plugin-proposal-object-rest-spread'],
          presets: [['@babel/preset-env', {targets: pkg.browserslist || _DEFAULTS.browserslist}]],
        }),
        minify &&
          terser({
            output: {
              comments: (_node, comment) => {
                const text = comment.value
                const type = comment.type

                // Check if this is a multiline comment
                if (type == 'comment2') {
                  // Keep licensing comments
                  return /@preserve|@license|@cc_on/i.test(text)
                }

                return false
              },
            },
          }),
      ].filter(Boolean),

      treeshake: {
        propertyReadSideEffects: false,
      },
    },
    outputOptions: {
      chunkFileNames: () => `_[name]-[hash]${outputExt}`,
      dir: outDir,
      entryFileNames: () => `[name]${outputExt}`,
      format,
      // esModule: true,
      exports: 'auto',
      // freeze: true,
      sourcemap: config?.sourcemap ?? true,
    },
  }
}
