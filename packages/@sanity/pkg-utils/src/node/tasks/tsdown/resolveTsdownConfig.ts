import path from 'node:path'
import type {Options as TsdownOptions} from 'tsdown'
import {resolveConfigProperty} from '../../core/config/resolveConfigProperty.ts'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import type {PackageJSON} from '../../core/pkg/types.ts'
import type {TsdownTask, TsdownWatchTask} from '../types.ts'
import {pkgExtMap as extMap} from '../../core/pkg/pkgExt.ts'

// Type guard to filter out falsy values
function isTruthy<T>(value: T | false | null | undefined | 0 | ''): value is T {
  return Boolean(value)
}

/** @internal */
export function resolveTsdownConfig(
  ctx: BuildContext,
  buildTask: TsdownTask | TsdownWatchTask,
): TsdownOptions {
  const {format, runtime, target} = buildTask
  const {config, cwd, exports: _exports, external, distPath, pkg, ts} = ctx
  const outputExt = extMap[pkg.type || 'commonjs'][format]
  const minify = config?.minify ?? false
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

  // Build entry object for tsdown
  const entry: Record<string, string> = {}
  for (const e of entries) {
    entry[e.name] = e.source
  }

  // Determine platform based on runtime
  const platform = runtime === 'browser' ? 'browser' : runtime === 'node' ? 'node' : 'neutral'

  // Configure Babel for React Compiler if needed
  const babelPlugins: Array<[string, any] | string> = []
  
  if (config?.babel?.styledComponents) {
    babelPlugins.push([
      'babel-plugin-styled-components',
      {
        fileName: false,
        transpileTemplateLiterals: false,
        pure: true,
        cssProp: false,
        ...(typeof config.babel.styledComponents === 'object'
          ? config.babel.styledComponents
          : {}),
      },
    ])
  }

  if (config?.babel?.reactCompiler) {
    babelPlugins.push([
      'babel-plugin-react-compiler',
      config?.reactCompilerOptions || {},
    ])
  }

  const tsdownOptions: TsdownOptions = {
    entry,
    outDir,
    format: format === 'commonjs' ? 'cjs' : format,
    platform,
    target: target.length > 0 ? target : undefined,
    tsconfig: ctx.ts.configPath || 'tsconfig.json',
    external: (id, importer) => {
      // Check if the id is a self-referencing import
      if (exportIds?.includes(id)) {
        return true
      }

      // Check if the id is a file path that points to an exported source file
      if (importer && (id.startsWith('.') || id.startsWith('/'))) {
        const idPath = path.resolve(path.dirname(importer), id)

        if (sourcePaths?.includes(idPath)) {
          return true
        }
      }

      const idParts = id.split('/')
      const name = idParts[0]!.startsWith('@') ? `${idParts[0]}/${idParts[1]}` : idParts[0]

      if (name && external.includes(name)) {
        return true
      }

      return false
    },
    alias: pathAliases,
    define: {
      'process.env.PKG_FORMAT': JSON.stringify(format),
      'process.env.PKG_RUNTIME': JSON.stringify(runtime),
      'process.env.PKG_VERSION': JSON.stringify(process.env['PKG_VERSION'] || pkg.version),
      ...replacements,
    },
    dts: true, // Always generate DTS files with tsdown
    sourcemap: config?.sourcemap ?? true,
    minify: minify ? true : false,
    clean: false, // We handle cleaning ourselves
    cwd,
    silent: true, // We handle logging ourselves
    // Configure fixed extensions based on package type and format
    fixedExtension: true, // Use .mjs/.cjs extensions
  }

  // Add Babel configuration if plugins are present
  if (babelPlugins.length > 0) {
    // tsdown uses rolldown which supports babel plugins
    // We need to use inputOptions to pass babel configuration
    tsdownOptions.inputOptions = (options) => {
      return {
        ...options,
        plugins: [
          ...(options.plugins || []),
          // Add babel plugin using @rollup/plugin-babel
          {
            name: 'babel-react-compiler',
            async transform(code: string, id: string) {
              if (!/\.[jt]sx?$/.test(id)) return null

              const {transformAsync} = await import('@babel/core')
              const result = await transformAsync(code, {
                filename: id,
                babelrc: false,
                presets: ['@babel/preset-typescript'],
                plugins: babelPlugins,
                babelHelpers: 'bundled',
              })

              if (!result || !result.code) return null

              return {
                code: result.code,
                map: result.map,
              }
            },
          },
        ],
      }
    }
  }

  return tsdownOptions
}

function hasDependency(pkg: PackageJSON, packageName: string): boolean {
  return pkg.dependencies
    ? packageName in pkg.dependencies
    : pkg.peerDependencies
      ? packageName in pkg.peerDependencies
      : false
}
