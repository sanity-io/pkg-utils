/**
 * A Vite 8 plugin for vanilla-extract: a port of `@vanilla-extract/vite-plugin` (MIT licensed,
 * Copyright (c) 2021 SEEK) with plugin hook filters, the environment-aware `hotUpdate` hook,
 * and a caching compiler on Vite's Environment API / `ModuleRunner` instead of `vite-node`.
 */
import {
  cssFileFilter,
  normalizePath,
  type IdentifierOption,
} from '@sanity/vanilla-extract-integration'
import {
  loadConfigFromFile,
  type ConfigEnv,
  type EnvironmentModuleNode,
  type Plugin,
  type PluginOption,
  type ResolvedConfig,
  type TransformResult,
  type UserConfig,
} from 'vite'
import {createCompiler, type Compiler} from './compiler.ts'
import {getAbsoluteId} from './ids.ts'

export {createCompiler} from './compiler.ts'
export type {Compiler, CreateCompilerOptions, ProcessedVanillaFile} from './compiler.ts'

const PLUGIN_NAMESPACE = 'sanity-vanilla-extract'

const virtualExtCss = '.vanilla.css'

const isVirtualId = (id: string) => id.endsWith(virtualExtCss)
const fileIdToVirtualId = (id: string) => `${id}${virtualExtCss}`
const virtualIdToFileId = (virtualId: string) => virtualId.slice(0, -virtualExtCss.length)

/**
 * Matches `.css.ts` (and sibling extensions) module ids, tolerating id queries (`?t=…` after an
 * HMR invalidation, `?v=…` for optimized ids) that the query-less `cssFileFilter` of
 * `@sanity/vanilla-extract-integration` would reject. The handlers still test the
 * query-stripped id against `cssFileFilter` itself.
 */
const CSS_FILE_ID_FILTER = /\.css\.(js|cjs|mjs|jsx|ts|tsx)(\?|$)/

/** Matches the ids of the virtual CSS modules emitted by the compiler, with or without query. */
const VIRTUAL_CSS_ID_FILTER = /\.vanilla\.css(\?|$)/

const isPluginObject = (plugin: PluginOption): plugin is Plugin =>
  typeof plugin === 'object' && plugin !== null && 'name' in plugin

/**
 * Flattens arbitrarily nested `PluginOption` arrays (presets return plugin groups) into plain
 * plugin objects; falsy entries and promises are dropped, like upstream.
 */
function flattenPluginObjects(option: PluginOption): Plugin[] {
  if (Array.isArray(option)) return option.flatMap(flattenPluginObjects)
  return isPluginObject(option) ? [option] : []
}

/**
 * Decides which of the consumer's Vite plugins are forwarded to the internal compiler server
 * that evaluates the `.css.ts` modules.
 * @public
 */
export type PluginFilter = (filterProps: {
  /** The name of the plugin. */
  name: string
  /**
   * The `mode` Vite is running in.
   * @see https://vite.dev/guide/env-and-mode.html#modes
   */
  mode: string
}) => boolean

/**
 * Options for {@link vanillaExtractPlugin}.
 * @public
 */
export interface Options {
  /**
   * Different formatting of identifiers (e.g. class names, keyframes, CSS Vars, etc).
   * @defaultValue `'short'` when `mode` is `'production'`, `'debug'` otherwise
   */
  identifiers?: IdentifierOption
  /**
   * Which of the consumer's Vite plugins are re-instantiated inside the compiler server that
   * evaluates the `.css.ts` modules. By default **no** plugins are forwarded (and the
   * filtering work is skipped entirely) — most plugins don't affect `.css.ts` evaluation, and
   * forwarding them would run every transform twice. Vite's own options (including the
   * built-in
   * [`resolve.tsconfigPaths`](https://vite.dev/config/shared-options#resolve-tsconfigpaths),
   * which replaces the `vite-tsconfig-paths` plugin on Vite 8) still apply to the compiler
   * server through the forwarded config.
   */
  pluginFilter?: PluginFilter
  /**
   * How the extracted CSS reaches the page during development:
   *
   * - `'emitCss'` (the default) serves each `.css.ts` module's CSS as a virtual `.vanilla.css`
   *   module through Vite's CSS pipeline.
   * - `'inlineCssInDev'` additionally inlines all extracted CSS into a `<style>` tag in the
   *   served HTML, preventing a flash of unstyled content in dev SSR setups where the virtual
   *   CSS modules only load client-side.
   *
   * Builds behave the same in both modes.
   * @defaultValue 'emitCss'
   */
  mode?: 'emitCss' | 'inlineCssInDev'
}

/**
 * A Vite 8 plugin that compiles vanilla-extract `.css.ts` modules and feeds their CSS into
 * Vite's own CSS pipeline (PostCSS, code-splitting, HMR, SSR) as virtual `.vanilla.css`
 * modules — the application-side counterpart to the library-build extraction of
 * `@sanity/vanilla-extract-rolldown-plugin`.
 *
 * Compared to `@vanilla-extract/vite-plugin` it declares
 * [plugin hook filters](https://vite.dev/guide/rolldown#hook-filter-feature) on its
 * `transform`/`resolveId`/`load` hooks (so rolldown-based Vite skips the Rust ↔ JS roundtrip
 * for unrelated modules, see
 * [vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)),
 * uses the environment-aware `hotUpdate` hook, and evaluates `.css.ts` modules through a
 * caching compiler built on Vite's Environment API / `ModuleRunner` instead of the legacy
 * `vite-node`.
 * @public
 */
export function vanillaExtractPlugin({
  identifiers,
  pluginFilter,
  mode = 'emitCss',
}: Options = {}): Plugin[] {
  let config: ResolvedConfig
  let configEnv: ConfigEnv
  let isBuild: boolean
  let compiler: Compiler | undefined
  let compilerReady: Promise<void> | undefined

  /** Normalized ids of the `.css.ts` modules processed so far (vanilla-extract boundaries). */
  const transformedModules = new Set<string>()

  const getIdentOption = () => identifiers ?? (config.mode === 'production' ? 'short' : 'debug')

  const initializeCompiler = async () => {
    let configForCompiler: UserConfig | undefined

    if (config.configFile) {
      // The user has a vite config file: re-load it to get fresh plugin instances for the
      // compiler server (plugin objects are stateful and can't be shared between servers)
      const configFile = await loadConfigFromFile(
        {
          command: config.command,
          mode: config.mode,
          isSsrBuild: configEnv.isSsrBuild,
        },
        config.configFile,
      )
      configForCompiler = configFile?.config
    } else {
      // The user is using a vite-based framework that has a custom config file
      configForCompiler = config.inlineConfig
    }

    // Without a `pluginFilter`, no consumer plugins are re-instantiated in the compiler
    // server, and the flatten/filter work is skipped entirely. Vite's own options — including
    // the built-in `resolve.tsconfigPaths`, which replaces the `vite-tsconfig-paths` plugin on
    // Vite 8 — still apply through the forwarded config.
    const viteConfig = {
      ...configForCompiler,
      plugins: pluginFilter
        ? flattenPluginObjects(configForCompiler?.plugins ?? [])
            // Never forward this plugin itself into its own compiler server
            .filter((plugin) => !plugin.name.startsWith(PLUGIN_NAMESPACE))
            .filter((plugin) => pluginFilter({name: plugin.name, mode: config.mode}))
        : undefined,
    }

    compiler = createCompiler({
      root: config.root,
      identifiers: getIdentOption(),
      cssImportSpecifier: fileIdToVirtualId,
      viteConfig,
      enableFileWatcher: !isBuild,
    })
  }

  /**
   * Lazily creates the compiler, memoizing the initialization promise. `buildStart` kicks this
   * off eagerly, but `transform` also awaits it: `transform` can run before `buildStart` has
   * finished when another plugin emits an additional entry whose module graph is transformed
   * concurrently.
   */
  const ensureCompiler = () => {
    compilerReady ??= initializeCompiler()
    return compilerReady
  }

  return [
    {
      name: `${PLUGIN_NAMESPACE}-inline-dev-css`,
      apply: (_config, {command}) => command === 'serve' && mode === 'inlineCssInDev',
      transformIndexHtml: () => {
        // Intentionally no `ensureCompiler()` here: an uninitialized compiler means no
        // `.css.ts` module has been transformed yet, so a freshly-created one would have no
        // CSS to inline either. In the dev SSR flows this mode exists for, module evaluation
        // (during render) precedes the HTML transform, so the CSS is already collected - and
        // the un-inlined fallback is Vite's own CSS pipeline, not missing styles.
        const allCss = compiler?.getAllCss()
        if (!allCss) return []
        return [
          {
            tag: 'style',
            children: allCss,
            attrs: {
              'type': 'text/css',
              'data-vanilla-extract-inline-dev-css': true,
            },
            injectTo: 'head-prepend',
          },
        ]
      },
    },
    {
      name: PLUGIN_NAMESPACE,

      config(_userConfig, env) {
        configEnv = env
        return {
          ssr: {
            // The evaluated `.css.ts` modules must share the project's `@vanilla-extract/*`
            // instances with the compiler, so keep them external in SSR environments
            external: [
              '@vanilla-extract/css',
              '@vanilla-extract/css/fileScope',
              '@vanilla-extract/css/adapter',
            ],
          },
        }
      },

      configResolved(resolvedConfig) {
        config = resolvedConfig
        isBuild = config.command === 'build' && !config.build.watch
      },

      configureServer(server) {
        server.watcher.on('unlink', (file) => {
          transformedModules.delete(normalizePath(file))
        })
      },

      async buildStart() {
        // Ensure the compiler instance is re-used between builds, e.g. in watch mode
        await ensureCompiler()
      },

      buildEnd() {
        // With the watcher, the compiler outlives individual builds and is closed through the
        // `closeWatcher` hook instead
        if (!config.build.watch) {
          void compiler?.close()
        }
      },

      closeWatcher() {
        return compiler?.close()
      },

      transform: {
        filter: {id: CSS_FILE_ID_FILTER},
        async handler(_code, id, options) {
          const [validId = id] = id.split('?')
          if (!cssFileFilter.test(validId)) return null

          // `transform` can run before `buildStart` has finished creating the compiler;
          // `ensureCompiler` is memoized, so this is a no-op once the compiler exists
          await ensureCompiler()
          if (!compiler) return null

          const absoluteId = getAbsoluteId({filePath: validId, root: config.root})

          const {source, watchFiles} = await compiler.processVanillaFile(absoluteId, {
            outputCss: true,
          })

          // Store the same absolute id the compiler's module graph uses (`validId` may be
          // root-relative in SSR or `/@id/`-wrapped), so the `findImporterTree` boundary
          // check in `hotUpdate` matches
          transformedModules.add(absoluteId)

          const result: TransformResult = {
            code: source,
            map: {mappings: ''},
          }

          // Watching files and invalidating modules only matters for the dev client pipeline
          if (isBuild || options?.ssr) {
            return result
          }

          for (const file of watchFiles) {
            if (!file.includes('node_modules') && normalizePath(file) !== absoluteId) {
              this.addWatchFile(file)
            }
          }

          return result
        },
      },

      // The compiler's module graph is always a subset of the consuming dev server's module
      // graph, so the early exit is hit for any file unrelated to vanilla-extract modules.
      // Fires once per environment; each invalidates the virtual CSS modules of its own graph.
      async hotUpdate({file, timestamp}) {
        if (!compiler) return

        const importerChain = await compiler.findImporterTree(
          normalizePath(file),
          transformedModules,
        )
        if (importerChain.size === 0) return

        const {moduleGraph} = this.environment
        const seen = new Set<EnvironmentModuleNode>()

        for (const mod of importerChain) {
          if (!mod.id) continue
          if (cssFileFilter.test(mod.id)) {
            // A vanilla-extract module: its CSS lives in the virtual module, invalidate that
            for (const virtualModule of moduleGraph.getModulesByFile(fileIdToVirtualId(mod.id)) ??
              []) {
              moduleGraph.invalidateModule(virtualModule, seen, timestamp, true)
            }
          } else {
            // `mod` is from the compiler's own module graph: look up the corresponding module
            // in this environment's graph by id
            const environmentModule = moduleGraph.getModuleById(mod.id)
            if (environmentModule) {
              moduleGraph.invalidateModule(environmentModule, seen, timestamp, true)
            }
          }
        }
      },

      resolveId: {
        filter: {id: VIRTUAL_CSS_ID_FILTER},
        handler(source) {
          const [validId = source, query] = source.split('?')
          if (!isVirtualId(validId) || !compiler) return undefined

          const absoluteId = getAbsoluteId({filePath: validId, root: config.root})

          // The only valid scenario for missing CSS is a file authored with the `.vanilla.css`
          // extension (or a module that produced no CSS); fall through to normal resolution
          const cssEntry = compiler.getCssForFile(virtualIdToFileId(absoluteId))
          if (!cssEntry?.css) return undefined

          // Keep the original query string for HMR
          return absoluteId + (query ? `?${query}` : '')
        },
      },

      load: {
        filter: {id: VIRTUAL_CSS_ID_FILTER},
        handler(id) {
          const [validId = id] = id.split('?')
          if (!isVirtualId(validId) || !compiler) return undefined

          const absoluteId = getAbsoluteId({filePath: validId, root: config.root})
          const cssEntry = compiler.getCssForFile(virtualIdToFileId(absoluteId))
          if (!cssEntry) return undefined

          // Vite's CSS pipeline owns the module from here (PostCSS, minification,
          // code-splitting, HMR style injection)
          return cssEntry.css
        },
      },
    },
  ]
}
