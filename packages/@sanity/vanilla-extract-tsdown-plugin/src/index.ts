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
import type {ResolvedConfig, Rolldown, TsdownPlugin} from 'tsdown'
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
   * Defaults to tsdown's top-level `target` when building through tsdown; when neither is
   * configured, the targets are resolved from `@sanity/browserslist-config`.
   */
  target?: string | string[] | false
  /**
   * Inject a CSS import into the JS output, like `css.inject` in `@tsdown/css` — but instead of
   * a relative `./<fileName>` import, the conditional-CSS-export flavor used by Sanity libraries:
   *
   * - injects the self-referential `import "<pkg-name>/<fileName>"` (or `require()` in CJS
   *   output) into every entry chunk that uses vanilla-extract styles, and
   * - emits a no-op `<fileName>.js` shim (plus a `<fileName>.d.ts` declaration) for the
   *   `node`/`default` conditions of a conditional `"./<fileName>"` export to point at, so the
   *   import resolves to a harmless module in runtimes that cannot import `.css` files.
   *
   * Unlike `@tsdown/css` this defaults to `true`, as the conditional CSS export pattern is the
   * point of this plugin. Disable it to only extract the CSS.
   * @defaultValue true
   */
  inject?: boolean
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
  const inject = options.inject ?? true

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
    if (options.target !== undefined) {
      const target = Array.isArray(options.target) ? options.target : [options.target]
      return esbuildTargetToLightningCSS(target)
    }
    if (tsdownTarget) return esbuildTargetToLightningCSS(tsdownTarget)
    return browserslistToTargets(browserslist(browserslistConfig))
  }

  function resolvePackageName(entryModuleId: string | null): string {
    // Prefer the package name tsdown resolved (`tsdownConfigResolved`); outside tsdown, resolve
    // the package.json owning the entry module (falling back to the working directory).
    const name =
      packageName ?? getPackageInfo(entryModuleId === null ? cwd : path.dirname(entryModuleId)).name
    if (!name) {
      throw new Error(
        `[vanilla-extract] Unable to resolve the package name from package.json, which is required by \`inject\` for the self-referential CSS import. Set \`inject: false\` to wire up the CSS import yourself.`,
      )
    }
    return name
  }

  return {
    name: 'vanilla-extract',

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

    // Inject the self-referential CSS import into entry chunks that use vanilla-extract styles
    renderChunk(code, chunk, outputOptions, meta) {
      if (!inject || styles.size === 0) return undefined
      if (!chunk.isEntry || chunk.name.endsWith('.d') || RE_DTS.test(chunk.fileName))
        return undefined
      const {format} = outputOptions
      if (format !== 'es' && format !== 'cjs') return undefined
      if (!chunkHasStyles(chunk, meta.chunks, styles)) return undefined

      const specifier = JSON.stringify(`${resolvePackageName(chunk.facadeModuleId)}/${fileName}`)
      const statement = format === 'cjs' ? `require(${specifier});\n` : `import ${specifier};\n`

      const {magicString} = meta
      if (magicString) {
        magicString.prepend(statement)
        return magicString
      }
      // Fallback when another `options` hook disabled `experimental.nativeMagicString`
      return {code: statement + code}
    },

    // Emit the merged CSS file (optimized with lightningcss) and, with `inject`, the JS shim
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

      if (inject) {
        this.emitFile({
          type: 'asset',
          fileName: `${fileName}.js`,
          source: `// No-op shim for \`${fileName}\` in runtimes that cannot import \`.css\` files directly.\nexport default ""\n`,
        })
        this.emitFile({
          type: 'asset',
          fileName: `${fileName}.d.ts`,
          source: `// Type declarations for \`${fileName}\` and its no-op JS shim.\ndeclare const _default: string\nexport default _default\n`,
        })
      }
    },
  }
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
 * Concatenate the extracted CSS of every chunk in the output, walking the chunk graph
 * depth-first with imported chunks before their importers (matching execution order, so the
 * CSS of shared chunks precedes the CSS of the entries that import them), and the modules
 * within each chunk in module order.
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
  }

  for (const chunk of chunks) visit(chunk)
  return css
}
