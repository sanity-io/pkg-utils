import path from 'node:path'
import type {InlineConfig as TsdownOptions} from 'tsdown'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import type {TsdownTask, TsdownWatchTask} from '../types.ts'

/** @internal */
export async function resolveTsdownConfig(
  ctx: BuildContext,
  buildTask: TsdownTask | TsdownWatchTask,
): Promise<TsdownOptions> {
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

  // Warn if babel-plugin-styled-components exists when using built-in styled-components support
  if (config?.styledComponents && ctx.strict) {
    try {
      // Check if babel-plugin-styled-components is in dependencies
      const hasBabelPlugin =
        pkg.dependencies?.['babel-plugin-styled-components'] ||
        pkg.devDependencies?.['babel-plugin-styled-components']

      if (hasBabelPlugin) {
        ctx.logger.warn(
          'babel-plugin-styled-components is installed but styled-components support is now built into rolldown/tsdown. Consider removing babel-plugin-styled-components from your dependencies.',
        )
      }
    } catch {
      // Ignore errors when checking for babel plugin
    }
  }

  // Configure Babel plugin for React Compiler if enabled
  const plugins: any[] = []

  if (config?.reactCompiler) {
    // Use the provided options or default to empty object
    const reactCompilerOptions =
      typeof config.reactCompiler === 'object' ? config.reactCompiler : {}

    // Use @rollup/plugin-babel for React Compiler as recommended by tsdown
    // @babel/preset-react transforms JSX before babel-plugin-react-compiler processes it
    const {babel} = await import('@rollup/plugin-babel')
    plugins.push(
      babel({
        babelHelpers: 'bundled',
        presets: [['@babel/preset-react', {runtime: 'automatic'}], '@babel/preset-typescript'],
        parserOpts: {sourceType: 'module', plugins: ['jsx', 'typescript']},
        plugins: [['babel-plugin-react-compiler', reactCompilerOptions]],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      }),
    )
  }

  // Configure vanilla-extract plugin if enabled
  if (config?.vanillaExtract) {
    const {vanillaExtractPlugin} = await import('@vanilla-extract/rollup-plugin')
    plugins.push(
      vanillaExtractPlugin(
        config.vanillaExtract === true
          ? {
              extract: {
                name:
                  runtime === 'node'
                    ? 'bundle.node.css'
                    : runtime === 'browser'
                      ? 'bundle.browser.css'
                      : 'bundle.css',
                sourcemap: true,
              },
              identifiers: 'short',
            }
          : config.vanillaExtract,
      ),
    )
  }

  // Determine chunk file naming - maintain compatibility with old rollup config
  // Default is _chunks folder with stable [name] naming (no hash)
  const chunksFolder = '_chunks'
  const outputExt = format === 'commonjs' ? '.cjs' : '.js'
  const chunkFileNames = `${chunksFolder}/[name]${outputExt}`

  const tsdownOptions: TsdownOptions = {
    // Don't try to resolve `tsdown.config.ts` files,
    config: false,

    // @TODO easier way to disable chunk hashing
    hash: false,
    entry,
    outDir,
    format: format === 'commonjs' ? 'cjs' : format,
    platform,
    target,
    tsconfig: ctx.ts.configPath || 'tsconfig.json',
    exports: {
      customExports(exports, context) {
        if (!context.pkg.exports) return exports
        for (const [key, value] of Object.entries(context.pkg.exports)) {
          if (typeof value === 'string') {
            exports[key] = value
          } else if (typeof value === 'object' && 'source' in value) {
            const {source: _, ...rest} = value
            exports[key] = context.isPublish ? rest : value
          }
        }
        for (const [key, value] of Object.entries(exports)) {
          if (typeof value === 'object' && !entries.some((entry) => entry.path === key)) {
            delete exports[key]
            continue
          }
        }

        return exports
      },
      devExports: 'source',
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
    dts: pkg.types
      ? {
          tsconfig: config?.tsconfig,
          tsgo:
            config?.tsgo ??
            (pkg.devDependencies && '@typescript/native-preview' in pkg.devDependencies),
        }
      : false, // Disable DTS generation for JS-only projects
    sourcemap: config?.sourcemap ?? true,
    minify,
    clean: false, // We handle cleaning ourselves
    cwd,
    // silent: true, // We handle logging ourselves
    // Don't use fixed extensions - let tsdown use package type to determine extension
    fixedExtension: false,
    publint: {
      enabled: true,
      level: 'error',
      strict: true,
    },
    // Add babel plugin for React Compiler if configured
    plugins: plugins.length > 0 ? plugins : undefined,
    // Configure rolldown's built-in styled-components support via inputOptions
    inputOptions: config?.styledComponents
      ? (options) => ({
          ...options,
          experimental: {
            ...options.experimental,
            attachDebugInfo: 'none',
          },
          treeshake: {
            propertyReadSideEffects: false,
            moduleSideEffects: [
              // If the module ends with `.css` it is considered to be a side effect, even if the module is marked as no side effect,
              {test: /\.css$/, sideEffects: true},
              // This is the equivalent of `moduleSideEffects: 'no-external'`, and included here so it works the same as before the CSS exemption were added.
              {external: true, sideEffects: false},
            ],
            annotations: true,
          },
          transform: {
            ...options.transform,
            plugins: {
              ...options.transform?.plugins,
              styledComponents: {
                // Unnecessary, as the way we use styled-components in Sanity is usually by wrapping `@sanity/ui` primitives, not declaring new ones like "const Button = styled.button``"
                fileName: false,
                // Native template literals take less space than this transpilation
                transpileTemplateLiterals: false,
                // Massively helps dead code elimination and tree-shaking
                pure: true,
                ...(config.styledComponents === true ? {} : config.styledComponents),
              },
            },
          },
        })
      : {
        experimental: {
          attachDebugInfo: 'none',
        },
        treeshake: {
          propertyReadSideEffects: false,
          moduleSideEffects: [
            // If the module ends with `.css` it is considered to be a side effect, even if the module is marked as no side effect,
            {test: /\.css$/, sideEffects: true},
            // This is the equivalent of `moduleSideEffects: 'no-external'`, and included here so it works the same as before the CSS exemption were added.
            {external: true, sideEffects: false},
          ],
          annotations: true,
        },
      },
    // Configure chunk output naming to maintain backward compatibility
    outputOptions: (options) => ({
      ...options,
      esModule: true,
      hoistTransitiveImports: false,
      assetFileNames: '[name][extname]',
      chunkFileNames,
    }),

    // hooks(hooks) {
    //   console.log(hooks)

    // }
  }

  return tsdownOptions
}
