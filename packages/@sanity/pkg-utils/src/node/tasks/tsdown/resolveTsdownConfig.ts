import path from 'node:path'
import type {Options as TsdownOptions} from 'tsdown'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import type {TsdownTask, TsdownWatchTask} from '../types.ts'

/** @internal */
export function resolveTsdownConfig(
  ctx: BuildContext,
  buildTask: TsdownTask | TsdownWatchTask,
): TsdownOptions {
  const {format, runtime, target} = buildTask
  const {config, cwd, exports: _exports, external, distPath, pkg, ts} = ctx
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

  // Warn if React Compiler or Styled Components are enabled - not yet supported with tsdown
  if (config?.babel?.reactCompiler) {
    ctx.logger.warn(
      'React Compiler is enabled but not yet fully supported with tsdown. Consider using @rollup/plugin-babel separately.',
    )
  }

  if (config?.babel?.styledComponents) {
    ctx.logger.warn(
      'Styled Components is enabled but not yet fully supported with tsdown. Consider using babel-plugin-styled-components separately.',
    )
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

  return tsdownOptions
}
