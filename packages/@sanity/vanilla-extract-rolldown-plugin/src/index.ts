import path from 'node:path'
import {
  compile,
  cssFileFilter,
  getPackageInfo,
  getSourceFromVirtualCssFile,
  processVanillaFile,
  virtualCssFileFilter,
  type IdentifierOption,
} from '@vanilla-extract/integration'
import {transform, type CustomAtRules, type Targets, type TransformOptions} from 'lightningcss'
import type {OutputChunk, Plugin, RenderedChunk} from 'rolldown'
import {cssFileDtsFileName, cssShimDtsFileName, cssShimFileName} from './cssShimFileName.ts'
import {esbuildTargetToLightningCSS} from './targets.ts'

export {cssFileDtsFileName, cssShimDtsFileName, cssShimFileName} from './cssShimFileName.ts'
export {esbuildTargetToLightningCSS} from './targets.ts'

/**
 * Options passed through to [lightningcss](https://lightningcss.dev)'s `transform()`, the same
 * shape as `css.lightningcss` in [`@tsdown/css`](https://tsdown.dev/options/css). Like there,
 * `targets` takes precedence over the esbuild-style {@link Options.target | `target`} option,
 * while the plugin-managed fields (`minify` from the {@link Options.minify | `minify`} option,
 * and `cssModules`, which vanilla-extract's own scoping makes redundant) win over their
 * `lightningcss` counterparts.
 * @public
 */
export type LightningCSSOptions = Omit<TransformOptions<CustomAtRules>, 'filename' | 'code'>

/**
 * The default name of the extracted CSS file (the {@link Options.fileName | `fileName`} option).
 * @public
 */
export const DEFAULT_CSS_FILE_NAME = 'bundle.css'

/** Matches the ids of the virtual modules created for compiled `.css.ts` modules. */
const RE_VANILLA_CSS_MODULE = /\.vanilla\.js$/

/** Matches rendered `.d.ts`/`.d.mts`/`.d.cts` chunk file names. */
const RE_DTS = /\.d\.[cm]?ts$/

/**
 * Options for {@link vanillaExtractPlugin}, modeled after the `css` options of
 * [`@tsdown/css`](https://tsdown.dev/options/css) so they feel familiar in a rolldown-based
 * toolchain.
 * @public
 */
export interface Options {
  /**
   * Different formatting of identifiers (e.g. class names, keyframes, CSS Vars, etc).
   * @defaultValue "short"
   */
  identifiers?: IdentifierOption
  /**
   * Name of the emitted CSS file that all extracted CSS is merged into, like `css.fileName`
   * in `@tsdown/css` (which defaults to `"style.css"`).
   * @defaultValue "bundle.css"
   */
  fileName?: string
  /**
   * Minify the extracted CSS with `lightningcss`, matching `css.minify` in `@tsdown/css`.
   * @defaultValue false
   */
  minify?: boolean
  /**
   * The target environment for CSS syntax lowering. Accepts esbuild-style target strings
   * (e.g. `'chrome90'`, `'safari16.2'`), like `css.target` in `@tsdown/css`. Set to `false`
   * to disable syntax lowering entirely.
   *
   * Defaults to the host-resolved {@link BuildContext.target} when an adapter provides one —
   * `@sanity/vanilla-extract-tsdown-plugin` forwards tsdown's resolved top-level `target` this
   * way. Matching `@tsdown/css`, syntax lowering is skipped when no target is configured
   * anywhere, or when the configured targets don't include any browsers (e.g. `'node20'`,
   * which speaks to the JS runtime, not the browsers the extracted CSS runs in).
   * `@sanity/tsdown-config` layers its own default on top, resolving browserless targets from
   * `@sanity/browserslist-config` and passing them through
   * {@link Options.lightningcss | `lightningcss.targets`}.
   */
  target?: string | string[] | false
  /**
   * Options passed through to `lightningcss`'s `transform()`, like `css.lightningcss` in
   * `@tsdown/css`. `lightningcss.targets` takes precedence over the esbuild-style
   * {@link Options.target | `target`}.
   */
  lightningcss?: LightningCSSOptions
  /**
   * Inject an import of the extracted CSS file into the JS output, like `css.inject` in
   * `@tsdown/css` (and matching its default of `false`):
   *
   * - `true` (or an object) injects a relative `import "./<fileName>"` (or `require()` in CJS
   *   output) into every entry chunk that uses vanilla-extract styles, so bundler-consumed
   *   libraries load their CSS automatically.
   * - `{nodeCompat: true}` additionally makes the import safe for runtimes that cannot import
   *   `.css` files: the injected import becomes the self-referential `"<pkg-name>/<fileName>"`
   *   bare specifier, and a no-op shim (e.g. `bundle-css.js`, plus `bundle.css.d.ts` /
   *   `bundle-css.d.ts` declarations) is emitted for the `node`/`default` conditions of the
   *   conditional `"./<fileName>"` export to point at. The shim is named with a hyphen
   *   (`bundle-css.js`) rather than a `.css.js` suffix so it does not match vanilla-extract's
   *   `cssFileFilter`. Writing that conditional export to `package.json` is the host's job —
   *   `@sanity/vanilla-extract-tsdown-plugin` maintains it automatically through tsdown's
   *   [`exports` feature](https://tsdown.dev/options/package-exports).
   *
   * `@sanity/tsdown-config` defaults this to `{nodeCompat: true}`.
   * @defaultValue false
   */
  inject?: boolean | {nodeCompat?: boolean}
}

/**
 * Build context resolved by the host bundler or build tool, providing defaults the plugin
 * cannot know on its own. Adapters push it through
 * {@link VanillaExtractPluginApi.setBuildContext} — e.g. `@sanity/vanilla-extract-tsdown-plugin`
 * forwards tsdown's resolved config from its `tsdownConfigResolved` hook.
 * @public
 */
export interface BuildContext {
  /** Default CSS syntax lowering target(s), used when the `target` option is not set. */
  target?: string | string[] | undefined
  /** The consumer's package name, for the self-referential import injected by `inject.nodeCompat`. */
  packageName?: string | undefined
  /** The working directory the `.css.ts` modules are compiled from. */
  cwd?: string | undefined
}

/**
 * The inter-plugin communication API exposed on the plugin's
 * [`api`](https://rolldown.rs/apis/plugin-api) property, for adapters that wrap this plugin
 * for a specific host (like `@sanity/vanilla-extract-tsdown-plugin` does for tsdown).
 * @public
 */
export interface VanillaExtractPluginApi {
  /**
   * Provides host-resolved defaults. May be called multiple times — e.g. once per output
   * format when the host runs parallel format builds with a shared plugin instance.
   */
  setBuildContext(context: BuildContext): void
}

/**
 * The rolldown plugin object returned by {@link vanillaExtractPlugin}, with the
 * {@link VanillaExtractPluginApi | api} property required so adapters can call it without
 * narrowing.
 * @public
 */
export type VanillaExtractPlugin = Plugin<VanillaExtractPluginApi> & {
  api: VanillaExtractPluginApi
}

/**
 * A rolldown plugin that compiles vanilla-extract `.css.ts` modules and extracts their CSS into
 * a single file, optionally lowered and minified with `lightningcss` — following the same
 * architecture (and option vocabulary and defaults) as `@tsdown/css`. Unlike
 * `@vanilla-extract/rollup-plugin` it doesn't declare
 * `rollup` as a peer dependency, and its `transform`/`resolveId`/`load` hooks declare filters
 * so rolldown skips the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related.
 *
 * The extract model is built for bundling libraries that ship pre-extracted CSS: usable from
 * raw rolldown, from tsdown through `@sanity/vanilla-extract-tsdown-plugin`, and from Vite
 * build-only library setups (`build.rolldownOptions.plugins`). It is not an application
 * (dev-server/HMR) plugin — Vite dev never runs the output-phase hooks the extraction relies
 * on; use `@sanity/vanilla-extract-vite-plugin` for Vite 8 apps.
 * @public
 */
export function vanillaExtractPlugin(options: Options = {}): VanillaExtractPlugin {
  const identifiers = options.identifiers ?? 'short'
  const fileName = options.fileName ?? DEFAULT_CSS_FILE_NAME
  const minify = options.minify ?? false
  const lightningcss = options.lightningcss
  const inject = Boolean(options.inject ?? false)
  /**
   * The conditional CSS export flavor of `inject`: a self-referential bare import specifier
   * backed by a no-op shim and a conditional `package.json` export, instead of a relative import.
   */
  const nodeCompat =
    typeof options.inject === 'object' ? (options.inject.nodeCompat ?? false) : false

  let cwd = process.cwd()
  /** The host-resolved default for the `target` option (e.g. tsdown's top-level `target`). */
  let contextTarget: string | string[] | undefined
  /** The consumer's package name, for the self-referential CSS import injected by `inject`. */
  let packageName: string | undefined

  /**
   * The extracted CSS of every compiled `.css.ts` module, keyed by the id of its virtual
   * `.vanilla.css` module. Hosts may run several builds in parallel with a shared plugin
   * instance (tsdown does, per output format), so the map is append-only (module ids are stable
   * and content converges) and the CSS is collected per output from the chunks in
   * `generateBundle`, never from build-wide state.
   */
  const styles = new Map<string, string>()

  function resolveTargets(): Targets | undefined {
    // Matching `@tsdown/css`: explicit `lightningcss.targets` win, then the esbuild-style
    // `target` (the option, falling back to the host-resolved context target) is converted.
    // Browserless targets (e.g. tsdown's common `target: 'node20'`, which speaks to the JS
    // runtime) convert to nothing, skipping syntax lowering — `@sanity/tsdown-config` layers
    // the `@sanity/browserslist-config` default on top through `lightningcss.targets`.
    if (lightningcss?.targets) return lightningcss.targets
    if (options.target === false) return undefined
    const target = options.target ?? contextTarget
    if (target === undefined) return undefined
    return esbuildTargetToLightningCSS(target)
  }

  function resolvePackageName(entryModuleId: string | null): string {
    // Prefer the host-provided package name (`api.setBuildContext`); otherwise, resolve the
    // package.json owning the entry module (falling back to the working directory).
    const name =
      packageName ?? getPackageInfo(entryModuleId === null ? cwd : path.dirname(entryModuleId)).name
    if (!name) {
      throw new Error(
        `[vanilla-extract] Unable to resolve the package name from package.json, which is required by \`inject.nodeCompat\` for the self-referential CSS import. Disable \`nodeCompat\` (or \`inject\`) to wire up the CSS import yourself.`,
      )
    }
    return name
  }

  return {
    name: 'vanilla-extract',

    api: {
      setBuildContext(context: BuildContext): void {
        if (context.target !== undefined) contextTarget = context.target
        if (context.packageName !== undefined) packageName = context.packageName
        if (context.cwd !== undefined) cwd = context.cwd
      },
    },

    // `inject` prepends the CSS import in `renderChunk` through rolldown's native MagicString
    // (`meta.magicString`), which keeps sourcemaps intact without a JS magic-string dependency.
    options(inputOptions) {
      if (!inject) return undefined
      return {
        ...inputOptions,
        experimental: {...inputOptions.experimental, nativeMagicString: true},
      }
    },

    // Compile .css.ts to .js
    transform: {
      filter: {id: cssFileFilter},
      async handler(_code, id) {
        const [filePath = id] = id.split('?')

        const {source, watchFiles} = await compile({
          filePath,
          cwd,
          identOption: identifiers,
        })

        for (const file of watchFiles) {
          this.addWatchFile(file)
        }

        const output = await processVanillaFile({
          source,
          filePath,
          identOption: identifiers,
        })
        return {
          code: output,
          map: {mappings: ''},
        }
      },
    },

    // Resolve the virtual .vanilla.css imports emitted by the transform, stashing their CSS
    resolveId: {
      filter: {id: virtualCssFileFilter},
      async handler(id) {
        const {fileName: virtualCssName, source} = await getSourceFromVirtualCssFile(id)
        // The `\0` prefix marks the id as virtual for other plugins, and the `.vanilla.css`
        // ending is rewritten to `.vanilla.js` to keep the id out of CSS pipelines (tsdown's
        // css-guard and `@tsdown/css` match module ids ending in `.css`, and vanilla-extract's
        // own `cssFileFilter` would match a `.css.js` ending). These modules must not be
        // processed as CSS: the CSS travels out-of-band in `styles` and is emitted as an asset
        // in `generateBundle`.
        const moduleId = `\0${virtualCssName.replace(/\.css$/, '.js')}`
        styles.set(moduleId, source)
        return moduleId
      },
    },

    // Load the virtual modules as empty JS modules: the CSS itself is emitted as an asset in
    // `generateBundle`, and `moduleSideEffects: 'no-treeshake'` keeps the empty modules in
    // their chunks so the CSS stays associated with (and ordered by) the module graph — the
    // same approach as `@tsdown/css`. This replaces the upstream rollup-plugin's external
    // `.vanilla.css` ids, so there are no leftover side-effect imports to strip.
    load: {
      filter: {id: RE_VANILLA_CSS_MODULE},
      handler(id) {
        if (!styles.has(id)) return undefined
        return {code: '', moduleType: 'js', moduleSideEffects: 'no-treeshake'}
      },
    },

    // Inject the CSS import into entry chunks that use vanilla-extract styles: relative by
    // default (like `css.inject` in `@tsdown/css`), or the self-referential bare specifier of
    // the conditional CSS export pattern with `nodeCompat`
    renderChunk(code, chunk, outputOptions, meta) {
      if (!inject || styles.size === 0) return undefined
      // The `.d` name / `.d.ts` file checks skip the chunks of tsdown's d.ts passes — they
      // never contain styles, so outside tsdown this is a harmless no-op guard.
      if (!chunk.isEntry || chunk.name.endsWith('.d') || RE_DTS.test(chunk.fileName))
        return undefined
      const {format} = outputOptions
      if (format !== 'es' && format !== 'cjs') return undefined
      if (!chunkHasStyles(chunk, meta.chunks, styles)) return undefined

      const specifier = JSON.stringify(
        nodeCompat
          ? `${resolvePackageName(chunk.facadeModuleId)}/${fileName}`
          : relativeImportPath(chunk.fileName, fileName),
      )
      const statement = format === 'cjs' ? `require(${specifier});\n` : `import ${specifier};\n`

      const {magicString} = meta
      if (magicString) {
        magicString.prepend(statement)
        return magicString
      }
      // Fallback when another `options` hook disabled `experimental.nativeMagicString`: the
      // import is still injected, but without the native magic-string the chunk's sourcemap
      // can't be adjusted for it (rolldown reports it as SOURCEMAP_BROKEN as well).
      if (outputOptions.sourcemap) {
        this.warn(
          `[vanilla-extract] rolldown's native magic-string is unavailable (another plugin's \`options\` hook may have disabled \`experimental.nativeMagicString\`), so the CSS import injected into "${chunk.fileName}" shifts its sourcemap by one line.`,
        )
      }
      return {code: statement + code}
    },

    // Emit the merged CSS file (optimized with lightningcss) and, with `inject.nodeCompat`,
    // the JS shim
    async generateBundle(_outputOptions, bundle) {
      // tsdown's cjs d.ts pass renders no JS chunks, so skip it instead of re-emitting the
      // assets (a harmless no-op guard outside tsdown)
      const chunks = Object.values(bundle).filter(
        (assetOrChunk): assetOrChunk is OutputChunk =>
          assetOrChunk.type === 'chunk' &&
          !assetOrChunk.name.endsWith('.d') &&
          !RE_DTS.test(assetOrChunk.fileName),
      )
      if (chunks.length === 0) return

      let css = collectCss(chunks, styles)

      // With `nodeCompat`, the conditional `./<fileName>` export (written into `package.json`
      // by the host at config-resolution time, before any CSS is known) must resolve, so the
      // CSS file and its shims are emitted even when no styles were extracted. Otherwise
      // nothing references an empty CSS file, so it would just be a stray artifact.
      if (!css && !nodeCompat) return

      // Like `@tsdown/css`, lightningcss only runs when it has something to do: syntax
      // lowering targets, minification, or custom `lightningcss` options
      const targets = resolveTargets()
      if (css && (targets || minify || lightningcss)) {
        // The spread order matches `@tsdown/css`: the plugin-managed fields (`targets` from
        // the resolved `target`, `minify`, and `cssModules`, which vanilla-extract's own
        // scoping makes redundant) win over their `lightningcss` counterparts
        const result = transform({
          filename: fileName,
          code: new TextEncoder().encode(css),
          ...lightningcss,
          minify,
          cssModules: false,
          targets,
        })
        for (const warning of result.warnings) {
          this.warn(
            `[vanilla-extract] ${warning.message} (${warning.loc.filename}:${warning.loc.line})`,
          )
        }
        css = new TextDecoder().decode(result.code)
        if (css.length && !css.endsWith('\n')) css += '\n'
      }

      this.emitFile({type: 'asset', fileName, source: css})

      if (nodeCompat) {
        const shimFileName = cssShimFileName(fileName)
        this.emitFile({
          type: 'asset',
          fileName: shimFileName,
          // The shim is intentionally free of syntax so it parses as both CommonJS and an ES
          // module: the package `type` decides how Node interprets a `.js` file, and the same
          // shim backs the `node`/`default` conditions for `require()` and `import` alike.
          // Named `bundle-css.js` (not `bundle.css.js`) so vanilla-extract's `cssFileFilter`
          // does not treat it as a stylesheet module when a consumer resolves `./bundle.css`.
          source: `// No-op shim for \`${fileName}\`, resolved by the \`node\`/\`default\` conditions of the\n// conditional CSS export so the self-referential import is harmless in runtimes that cannot\n// load \`.css\` files. Intentionally has no JS syntax: it parses as both CommonJS and an ES\n// module, regardless of the package \`type\`.\n`,
        })
        // Emit declaration companions for both export targets: `browser`/`style` resolve the
        // CSS file (`bundle.css` → `bundle.css.d.ts`), while `node`/`default` resolve the shim
        // (`bundle-css.js` → `bundle-css.d.ts`).
        const dtsSource = `// Type declarations for \`${fileName}\` and its no-op JS shim.\nexport {}\n`
        this.emitFile({
          type: 'asset',
          fileName: cssFileDtsFileName(fileName),
          source: dtsSource,
        })
        this.emitFile({
          type: 'asset',
          fileName: cssShimDtsFileName(fileName),
          source: dtsSource,
        })
      }
    },
  }
}

/**
 * The relative import path from a chunk to the emitted CSS file (which lives at the root of the
 * output directory), like the `css.inject` implementation in `@tsdown/css`.
 */
function relativeImportPath(chunkFileName: string, cssFileName: string): string {
  const relativePath = path.posix.relative(path.posix.dirname(chunkFileName), cssFileName)
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

/**
 * Whether a chunk (or any chunk it imports, transitively) contains vanilla-extract styles.
 */
function chunkHasStyles(
  chunk: RenderedChunk,
  chunks: Record<string, RenderedChunk>,
  styles: ReadonlyMap<string, string>,
): boolean {
  const seen = new Set<string>()
  const queue: RenderedChunk[] = [chunk]
  for (let current = queue.pop(); current; current = queue.pop()) {
    if (seen.has(current.fileName)) continue
    seen.add(current.fileName)
    if (current.moduleIds.some((id) => styles.has(id))) return true
    for (const imported of [...current.imports, ...current.dynamicImports]) {
      const importedChunk = chunks[imported]
      if (importedChunk) queue.push(importedChunk)
    }
  }
  return false
}

/**
 * Concatenate the extracted CSS of every chunk in the output in execution order: starting from
 * the entry chunks, statically imported chunks come before their importers, the modules within
 * each chunk follow module order, and dynamically imported chunks follow their importer (they
 * load later at runtime). Chunks not reachable from an entry are appended last, so the order
 * never depends on the bundle's own iteration order.
 */
function collectCss(chunks: OutputChunk[], styles: ReadonlyMap<string, string>): string {
  const chunksByFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
  const seen = new Set<string>()
  let css = ''

  const visit = (chunk: OutputChunk): void => {
    if (seen.has(chunk.fileName)) return
    seen.add(chunk.fileName)
    for (const imported of chunk.imports) {
      const importedChunk = chunksByFileName.get(imported)
      if (importedChunk) visit(importedChunk)
    }
    for (const id of chunk.moduleIds) {
      const moduleCss = styles.get(id)
      if (!moduleCss) continue
      css += moduleCss
      if (!moduleCss.endsWith('\n')) css += '\n'
    }
    for (const dynamicallyImported of chunk.dynamicImports) {
      const dynamicChunk = chunksByFileName.get(dynamicallyImported)
      if (dynamicChunk) visit(dynamicChunk)
    }
  }

  for (const chunk of chunks) {
    if (chunk.isEntry) visit(chunk)
  }
  for (const chunk of chunks) visit(chunk)
  return css
}
