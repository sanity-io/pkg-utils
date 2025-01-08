import path from 'node:path'

import type {PluginItem} from '@babel/core'
import {optimizeLodashImports} from '@optimize-lodash/rollup-plugin'
import alias from '@rollup/plugin-alias'
import {babel, getBabelOutputPlugin} from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import {nodeResolve} from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import type {InputOptions, OutputOptions, Plugin} from 'rollup'
import esbuild from 'rollup-plugin-esbuild'

import {pkgExtMap as extMap} from '../../../node/core/pkg/pkgExt'
import {type BuildContext, type PackageJSON, resolveConfigProperty} from '../../core'
import type {RollupLegacyTask, RollupTask, RollupWatchTask} from '../types'

export interface RollupConfig {
  inputOptions: InputOptions
  outputOptions: OutputOptions
}

/** @internal */
export function resolveRollupConfig(
  ctx: BuildContext,
  buildTask: RollupTask | RollupLegacyTask | RollupWatchTask,
): RollupConfig {
  const {format, runtime, target} = buildTask
  const {config, cwd, exports: _exports, external, distPath, logger, pkg, ts} = ctx
  const isLegacyExports = buildTask.type === 'build:legacy'
  const outputExt = isLegacyExports ? extMap.legacy : extMap[pkg.type || 'commonjs'][format]
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

  const {optimizeLodash: enableOptimizeLodash = hasDependency(pkg, 'lodash')} = config?.rollup || {}

  const defaultPlugins = [
    replace({
      preventAssignment: true,
      values: {
        ...(pkg.name === '@sanity/pkg-utils'
          ? {...replacements}
          : {
              'process.env.PKG_FILE_PATH': (arg) => {
                const sourcePath = `./${path.relative(cwd, arg)}`
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
              'process.env.PKG_VERSION': JSON.stringify(process.env['PKG_VERSION'] || pkg.version),
              ...replacements,
            }),
      },
    }),
    alias({
      entries: {...pathAliases},
    }),
    nodeResolve({
      browser: runtime === 'browser',
      extensions: ['.cjs', '.mjs', '.js', '.jsx', '.json', '.node'],
      preferBuiltins: true,
    }),
    commonjs(),
    json(),
    (config?.babel?.reactCompiler || config?.babel?.styledComponents) &&
      babel({
        babelrc: false,
        presets: ['@babel/preset-typescript'],
        babelHelpers: 'bundled',
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        plugins: [
          // The styled-components plugin needs to run before the react-compiler plugin, in case the css prop is used
          config?.babel?.styledComponents && [
            'babel-plugin-styled-components',
            {
              // Unnecessary, as the way we use styled-components in Sanity is usually by wrapping `@sanity/ui` primitives, not declaring new ones like "const Button = styled.button``"
              fileName: false,
              // Native template literals take less space than this transpilation
              transpileTemplateLiterals: false,
              // Massively helps dead code elimination and tree-shaking
              pure: true,
              // disabled, as pkg-utils tends to be used for npm publishing, while other tooling, like `sanity dev`, `next dev`, etc are used for testing
              cssProp: false,
              ...(typeof config.babel.styledComponents === 'object'
                ? config.babel.styledComponents
                : {}),
            },
          ],
          config?.babel?.reactCompiler && [
            'babel-plugin-react-compiler',
            config?.reactCompilerOptions || {},
          ],
        ].filter(Boolean) as PluginItem[],
      }),
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
        plugins: config.babel.plugins,
      }),
    enableOptimizeLodash &&
      optimizeLodashImports({
        useLodashEs: format === 'esm' && hasDependency(pkg, 'lodash-es') ? true : undefined,
        ...(typeof config?.rollup?.optimizeLodash === 'boolean'
          ? {}
          : config?.rollup?.optimizeLodash),
      }),
    minify &&
      terser({
        compress: {directives: false, passes: 10},
        ecma: 2020,
        output: {
          comments: (_node, comment) => {
            const text = comment.value
            const cType = comment.type

            // Check if this is a multiline comment
            if (cType === 'comment2') {
              // Keep licensing comments
              return /@preserve|@license|@cc_on/i.test(text)
            }

            return false
          },
          preserve_annotations: true,
        },
      }),
  ].filter(Boolean) as Plugin[]

  const userPlugins = config?.rollup?.plugins

  const plugins = Array.isArray(userPlugins)
    ? defaultPlugins.concat(userPlugins)
    : resolveConfigProperty(config?.rollup?.plugins, defaultPlugins)

  const hashChunkFileNames = config?.rollup?.hashChunkFileNames ?? false
  const chunksFolder = isLegacyExports
    ? '_legacy'
    : hashChunkFileNames
      ? '_chunks'
      : '_chunks-[format]'
  const chunkFileNames = `${chunksFolder}/${hashChunkFileNames ? '[name]-[hash]' : '[name]'}${outputExt}`
  const entryFileNames = isLegacyExports ? '[name].js' : `[name]${outputExt}`

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
        moduleSideEffects: 'no-external',
        ...config?.rollup?.treeshake,
      },
      experimentalLogSideEffects: config?.rollup?.experimentalLogSideEffects,
    },
    outputOptions: {
      chunkFileNames,
      compact: minify,
      dir: outDir,
      entryFileNames,
      esModule: true,
      format,
      interop: 'compat',
      sourcemap: config?.sourcemap ?? true,
      hoistTransitiveImports: false,
      minifyInternalExports: minify,
      ...config?.rollup?.output,
    },
  }
}

function hasDependency(pkg: PackageJSON, packageName: string): boolean {
  return pkg.dependencies
    ? packageName in pkg.dependencies
    : pkg.peerDependencies
      ? packageName in pkg.peerDependencies
      : false
}
