import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import {nodeResolve} from '@rollup/plugin-node-resolve'
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

  return {
    inputOptions: {
      context: cwd,

      external,

      input: buildTask.entries.reduce<{[entryAlias: string]: string}>((acc, entry) => {
        const key = entry.path === '.' ? 'index' : entry.path.slice(2)

        return {...acc, [key]: entry.source || ''}
      }, {}),

      plugins: [
        nodeResolve({
          mainFields: ['module', 'jsnext', 'main'],
          browser: runtime !== 'node',
          exportConditions: [runtime === 'node' ? 'node' : 'browser'],
          extensions: ['.cjs', '.mjs', '.js', '.jsx', '.json', '.node'],
          preferBuiltins: runtime === 'node',
        }),
        commonjs({
          esmExternals: false,
          include: /\/node_modules\//,
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
      esModule: false,
      exports: 'auto',
      freeze: false,
      sourcemap: true,
    },
  }
}
