import path from 'path'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import {nodeResolve} from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import {InputOptions, OutputOptions} from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import {_BuildContext} from '../../_types'
import {_RollupTask} from './rollup'

/**
 * @internal
 */
export function _resolveRollupConfig(
  ctx: _BuildContext,
  buildTask: _RollupTask
): {
  inputOptions: InputOptions
  outputOptions: OutputOptions
} {
  const {format, runtime, target} = buildTask
  const {cwd, external, dist: outDir, pkg, tsconfig} = ctx
  const outputExt = format === 'commonjs' ? '.cjs' : pkg.type === 'module' ? '.mjs' : '.js'
  const nodeModulesPath = path.resolve(cwd, 'node_modules')

  const entries = buildTask.entries.map((entry) => {
    return {
      ...entry,
      name: path.relative(outDir, entry.output).replace(/\.[^/.]+$/, ''),
    }
  }, {})

  const config: {
    inputOptions: InputOptions
    outputOptions: OutputOptions
  } = {
    inputOptions: {
      context: cwd,

      external: (id, _importer) => {
        const idParts = id.split('/')

        const name = idParts[0].startsWith('@') ? `${idParts[0]}/${idParts[1]}` : idParts[0]

        if (name && external.includes(name)) {
          return true
        }

        if (id.startsWith(nodeModulesPath)) {
          // TODO
          // eslint-disable-next-line no-console
          // console.log('not external?', {id: path.relative(cwd, id), importer})

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
          values:
            pkg.name === '@sanity/pkg-utils'
              ? {}
              : {
                  'process.env.PKG_FORMAT': JSON.stringify(format),
                  'process.env.PKG_RUNTIME': JSON.stringify(runtime),
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
                },
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
          // include: /\/node_modules\//,
          // requireReturnsDefault: 'namespace',
        }),
        json(),
        esbuild({
          // include: /\.[jt]sx?$/, // default, inferred from `loaders` option
          // exclude: /node_modules/, // default
          // sourceMap: false, // by default inferred from rollup's `output.sourcemap` option
          minify: false, // process.env.NODE_ENV === 'production',
          // target: 'es2017', // default, or 'es20XX', 'esnext'
          jsx: 'transform', // default, or 'preserve'
          jsxFactory: 'React.createElement',
          jsxFragment: 'React.Fragment',
          // // Like @rollup/plugin-replace
          // define: {
          //   __VERSION__: '"x.y.z"',
          // },
          // plugins: [],
          target,
          // target:
          //   target === 'node'
          //     ? ['node12']
          //     : ['es2020', 'chrome104', 'edge104', 'firefox103', 'safari15'],
          tsconfig: tsconfig || 'tsconfig.json', // 'tsconfig.json', // default
          // Add extra loaders
          loaders: {
            // Add .json files support
            // require @rollup/plugin-commonjs
            '.json': 'json',
            // Enable JSX in .js files too
            // '.js': 'jsx',
          },
        }),
      ],

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
      // exports: 'auto',
      // freeze: true,
      sourcemap: true,
    },
  }

  return config
}
