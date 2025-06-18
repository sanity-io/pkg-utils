import path from 'node:path'
import {optimizeLodashImports} from '@optimize-lodash/rollup-plugin'
import alias from '@rollup/plugin-alias'
import {getBabelOutputPlugin} from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import {nodeResolve} from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import type {InputOptions, OutputOptions, Plugin} from 'rolldown'
import {dts as dtsPlugin} from 'rolldown-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'
import type {BuildContext} from '../../core/contexts/buildContext'
import {pkgExtMap as extMap} from '../../core/pkg/pkgExt'
import type {PackageJSON} from '../../core/pkg/types'
import type {RolldownDtsTask} from '../types'

export interface RolldownConfig {
  inputOptions: InputOptions
  outputOptions: OutputOptions
}

export function resolveRolldownConfig(
  ctx: BuildContext,
  buildTask: RolldownDtsTask,
): RolldownConfig {
  const {format, runtime, target} = buildTask
  const {config, cwd, exports: _exports, external, distPath, logger, pkg, ts} = ctx
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

  const {optimizeLodash: enableOptimizeLodash = hasDependency(pkg, 'lodash')} = config?.rollup || {}

  // @ts-expect-error - TODO: fix this
  const _defaultPlugins = [
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
    esbuild({
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

  const hashChunkFileNames = config?.rollup?.hashChunkFileNames ?? false
  const chunksFolder = hashChunkFileNames ? '_chunks' : '_chunks-[format]'
  const chunkFileNames = `${chunksFolder}/${hashChunkFileNames ? '[name]-[hash]' : '[name]'}${outputExt}`
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

    input: entries.reduce<{[entryAlias: string]: string}>(
      (acc, entry) => Object.assign(acc, {[entry.name]: entry.source}),
      {},
    ),

    plugins: [dtsPlugin({emitDtsOnly: true, tsconfig: ctx.ts.configPath || 'tsconfig.json'})],

    treeshake: true,
  } satisfies InputOptions
  const outputOptions = {
    chunkFileNames,
    dir: outDir,
    entryFileNames,
    esModule: true,
    format: buildTask.type === 'rolldown:dts' ? 'es' : format,
    sourcemap: buildTask.type === 'rolldown:dts' ? false : (config?.sourcemap ?? true),
    hoistTransitiveImports: false,
  } satisfies OutputOptions

  return {inputOptions, outputOptions}
}

function hasDependency(pkg: PackageJSON, packageName: string): boolean {
  return pkg.dependencies
    ? packageName in pkg.dependencies
    : pkg.peerDependencies
      ? packageName in pkg.peerDependencies
      : false
}
