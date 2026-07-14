import path from 'node:path'
import browserslistConfig from '@sanity/browserslist-config'
import {
  compile,
  cssFileFilter,
  getPackageInfo,
  getSourceFromVirtualCssFile,
  processVanillaFile,
  virtualCssFileFilter,
  type IdentifierOption,
} from '@vanilla-extract/integration'
import browserslist from 'browserslist'
import {browserslistToTargets, transform, type Targets} from 'lightningcss'
import type {ResolvedConfig, Rolldown, TsdownPlugin, UserConfig} from 'tsdown'
import {createConditionalCssExport, insertCssExport} from './exports.ts'
import {esbuildTargetToLightningCSS} from './targets.ts'

/** The default name of the extracted CSS file. */
const DEFAULT_CSS_FILE_NAME = 'bundle.css'

/** Matches the ids of the virtual modules created for compiled `.css.ts` modules. */
const RE_VANILLA_CSS_MODULE = /\.vanilla\.js$/

/** Matches rendered `.d.ts`/`.d.mts`/`.d.cts` chunk file names. */
const RE_DTS = /\.d\.[cm]?ts$/

/**
 * Options for {@link vanillaExtractPlugin}, modeled after the `css` options of
 * [`@tsdown/css`](https://tsdown.dev/options/css) so they feel familiar in a tsdown config.
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
   * Minify the extracted CSS with `lightningcss`, like `css.minify` in `@tsdown/css`
   * (which defaults to `false`).
   * @defaultValue true
   */
  minify?: boolean
  /**
   * The target environment for CSS syntax lowering. Accepts esbuild-style target strings
   * (e.g. `'chrome90'`, `'safari16.2'`), like `css.target` in `@tsdown/css`. Set to `false`
   * to disable syntax lowering entirely.
   *
   * Defaults to tsdown's top-level `target` when building through tsdown. When neither is
   * configured — or when the configured targets don't include any browsers (e.g. `'node20'`,
   * common for libraries, says nothing about the browsers the extracted CSS runs in) — the
   * targets are resolved from `@sanity/browserslist-config` instead. (`@tsdown/css` would
   * silently skip syntax lowering in that case.)
   */
  target?: string | string[] | false
  /**
   * Inject an import of the extracted CSS file into the JS output, like `css.inject` in
   * `@tsdown/css` (and matching its default of `false`):
   *
   * - `true` (or an object) injects a relative `import "./<fileName>"` (or `require()` in CJS
   *   output) into every entry chunk that uses vanilla-extract styles, so bundler-consumed
   *   libraries load their CSS automatically.
   * - `{nodeCompat: true}` additionally makes the import safe for runtimes that cannot import
   *   `.css` files: the injected import becomes the self-referential `"<pkg-name>/<fileName>"`
   *   bare specifier, a no-op `<fileName>.js` shim (plus a `<fileName>.d.ts` declaration) is
   *   emitted for the `node`/`default` conditions of the conditional `"./<fileName>"` export to
   *   point at, and — when tsdown's
   *   [`exports` feature](https://tsdown.dev/options/package-exports) is enabled — that
   *   conditional export is written to `package.json` (`browser`/`style` → the real CSS,
   *   `node`/`default` → the shim) through `exports.customExports`.
   *
   * `@sanity/tsdown-config` defaults this to `{nodeCompat: true}`.
   * @defaultValue false
   */
  inject?: boolean | {nodeCompat?: boolean}
}

/**
 * A tsdown plugin that compiles vanilla-extract `.css.ts` modules and extracts their CSS into a
 * single `lightningcss`-optimized file, following the same architecture (and option vocabulary)
 * as `@tsdown/css`. Unlike `@vanilla-extract/rollup-plugin` it doesn't declare `rollup` as a
 * peer dependency, and its `transform`/`resolveId`/`load` hooks declare filters so rolldown
 * skips the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related.
 * @public
 */
export function vanillaExtractPlugin(options: Options = {}): TsdownPlugin {
  const identifiers = options.identifiers ?? 'short'
  const fileName = options.fileName ?? DEFAULT_CSS_FILE_NAME
  const minify = options.minify ?? true
  const inject = Boolean(options.inject ?? false)
  /**
   * The conditional CSS export flavor of `inject`: a self-referential bare import specifier
   * backed by a no-op shim and a conditional `package.json` export, instead of a relative import.
   */
  const nodeCompat =
    typeof options.inject === 'object' ? (options.inject.nodeCompat ?? false) : false

  let cwd = process.cwd()
  /** tsdown's resolved top-level `target`, the default for the `target` option. */
  let tsdownTarget: string[] | undefined
  /** The consumer's package name, for the self-referential CSS import injected by `inject`. */
  let packageName: string | undefined

  /**
   * The extracted CSS of every compiled `.css.ts` module, keyed by the id of its virtual
   * `.vanilla.css` module. tsdown runs the format builds in parallel with a shared plugin
   * instance, so the map is append-only (module ids are stable and content converges) and the
   * CSS is collected per output from the chunks in `generateBundle`, never from build-wide state.
   */
  const styles = new Map<string, string>()

  function resolveTargets(): Targets | undefined {
    if (options.target === false) return undefined
    const target = options.target ?? tsdownTarget
    if (target !== undefined) {
      const targets = esbuildTargetToLightningCSS(Array.isArray(target) ? target : [target])
      if (targets) return targets
    }
    // The extracted CSS always runs in browsers, so a target list without any browsers (e.g.
    // tsdown's common `target: 'node20'`, which speaks to the JS runtime) falls back to
    // `@sanity/browserslist-config` instead of silently disabling syntax lowering the way
    // `@tsdown/css` does — `target: false` is the explicit off switch.
    return browserslistToTargets(browserslist(browserslistConfig))
  }

  function resolvePackageName(entryModuleId: string | null): string {
    // Prefer the package name tsdown resolved (`tsdownConfigResolved`); outside tsdown, resolve
    // the package.json owning the entry module (falling back to the working directory).
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

    // With `inject.nodeCompat`, write the conditional `./<fileName>` export to `package.json`
    // (and, through tsdown, to `publishConfig.exports`) by composing into `exports.customExports`
    // before the config is resolved — the tsdown analogue of a Vite plugin extending the user
    // config from its `config` hook. tsdown's `exports` feature is opt-in, so nothing is written
    // (and the conditional export has to be maintained manually) when it's not enabled.
    tsdownConfig(config: UserConfig) {
      if (!nodeCompat) return undefined
      const exportsOption = config.exports
      if (!exportsOption) return undefined

      // Normalize the `boolean | CIOption | object` forms of the `exports` option into the
      // object form, preserving the enabled-ness (`true` and bare CI conditions mean enabled)
      const exportsOptions: Extract<NonNullable<UserConfig['exports']>, object> = exportsOption ===
      true
        ? {}
        : typeof exportsOption === 'string'
          ? {enabled: exportsOption}
          : exportsOption

      const conditionalCssExport = createConditionalCssExport(fileName, config.outDir ?? 'dist')
      const previousCustomExports = exportsOptions.customExports
      exportsOptions.customExports = async (exportsMap, context) => {
        // Apply a pre-existing `customExports` first (both its function and record forms,
        // mirroring how tsdown itself applies them), then insert the conditional CSS export
        const base =
          typeof previousCustomExports === 'function'
            ? await previousCustomExports(exportsMap, context)
            : previousCustomExports
              ? {...exportsMap, ...previousCustomExports}
              : exportsMap
        return insertCssExport(base, `./${fileName}`, conditionalCssExport)
      }
      config.exports = exportsOptions
      return undefined
    },

    // Pick up the tsdown-resolved context: the top-level `target` (the default for the CSS
    // syntax lowering target, like `css.target` in `@tsdown/css`) and the package name (for
    // the self-referential import injected by `inject`). The hook fires once per output
    // format with the same values. Outside tsdown the plugin falls back to
    // `@sanity/browserslist-config` and reading package.json from the working directory.
    tsdownConfigResolved(config: ResolvedConfig) {
      tsdownTarget = config.target
      packageName = config.pkg?.name ?? packageName
      cwd = config.cwd ?? cwd
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
      // The cjs d.ts pass renders no JS chunks, so skip it instead of re-emitting the assets
      const chunks = Object.values(bundle).filter(
        (assetOrChunk): assetOrChunk is Rolldown.OutputChunk =>
          assetOrChunk.type === 'chunk' &&
          !assetOrChunk.name.endsWith('.d') &&
          !RE_DTS.test(assetOrChunk.fileName),
      )
      if (chunks.length === 0) return

      let css = collectCss(chunks, styles)

      // With `nodeCompat`, the conditional `./<fileName>` export (written into `package.json` by
      // the `tsdownConfig` hook at config-resolution time, before any CSS is known) must resolve,
      // so the CSS file and its shims are emitted even when no styles were extracted. Otherwise
      // nothing references an empty CSS file, so it would just be a stray artifact.
      if (!css && !nodeCompat) return

      const targets = resolveTargets()
      if (css && (targets || minify)) {
        const result = transform({
          filename: fileName,
          code: new TextEncoder().encode(css),
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
        this.emitFile({
          type: 'asset',
          fileName: `${fileName}.js`,
          // The shim is intentionally free of syntax so it parses as both CommonJS and an ES
          // module: the package `type` decides how Node interprets a `.js` file, and the same
          // shim backs the `node`/`default` conditions for `require()` and `import` alike.
          source: `// No-op shim for \`${fileName}\`, resolved by the \`node\`/\`default\` conditions of the\n// conditional CSS export so the self-referential import is harmless in runtimes that cannot\n// load \`.css\` files. Intentionally has no JS syntax: it parses as both CommonJS and an ES\n// module, regardless of the package \`type\`.\n`,
        })
        this.emitFile({
          type: 'asset',
          fileName: `${fileName}.d.ts`,
          source: `// Type declarations for \`${fileName}\` and its no-op JS shim.\nexport {}\n`,
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
  chunk: Rolldown.RenderedChunk,
  chunks: Record<string, Rolldown.RenderedChunk>,
  styles: ReadonlyMap<string, string>,
): boolean {
  const seen = new Set<string>()
  const queue: Rolldown.RenderedChunk[] = [chunk]
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
function collectCss(chunks: Rolldown.OutputChunk[], styles: ReadonlyMap<string, string>): string {
  const chunksByFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
  const seen = new Set<string>()
  let css = ''

  const visit = (chunk: Rolldown.OutputChunk): void => {
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
