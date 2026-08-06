import path from 'node:path'
import {
  createConditionalCssExport,
  createCssExport,
  cssShimDtsFileName,
  cssShimDtsSource,
  cssShimFileName,
  cssShimSource,
  insertCssExport,
  resolveCssExportOptions,
  type CssExportsOptions,
} from '@sanity/vanilla-extract-tsdown-plugin'
import type {ResolvedConfig, TsdownPlugin, UserConfig} from 'tsdown'

/**
 * Matches the module ids `@tsdown/css` treats as stylesheets, so this plugin can tell which
 * chunks pulled CSS in without reaching into `@tsdown/css`'s own bookkeeping.
 */
const RE_CSS_LANG = /\.(css|less|sass|scss|styl|stylus)(?:$|\?)/
/** Matches `?inline` CSS imports, which `@tsdown/css` inlines into JS instead of extracting. */
const RE_CSS_INLINE = /[?&]inline\b/
/** Matches rendered `.d.ts`/`.d.mts`/`.d.cts` chunk file names. */
const RE_DTS = /\.d\.[cm]?ts$/
/** Matches the emitted CSS assets whose shims and exports this plugin maintains. */
const RE_CSS_ASSET = /\.css$/

/** `index.mjs` -> `index.css`, the naming `@tsdown/css` uses when `css.splitting` is on. */
function toCssFileName(jsFileName: string): string {
  return jsFileName.replace(/(?:\.module)?(\.[cm]?js)$/, '.css')
}

/**
 * The `@tsdown/css` options this plugin needs to mirror. Kept structural so the plugin does not
 * have to import `@tsdown/css` (an optional peer dependency) for its types.
 */
export interface CssNodeCompatPluginOptions {
  /** `css.fileName`, the merged CSS file name when `css.splitting` is off. */
  fileName?: string | undefined
  /** `css.splitting`, which switches CSS output from one merged file to one file per chunk. */
  splitting?: boolean | undefined
  /** Prepend an import of the CSS to entry chunks that use it. */
  inject?: boolean | undefined
  /** Publish the CSS files as export subpaths, optionally with the Node-safe shim. */
  exports?: boolean | CssExportsOptions | undefined
}

/**
 * A tsdown plugin that gives `@tsdown/css` output the same conditional CSS export pattern
 * `@sanity/vanilla-extract-tsdown-plugin` gives vanilla-extract output.
 *
 * `@tsdown/css` compiles CSS but has no node-shim concept: its only `inject` is a relative
 * `import "./style.css"`, which throws in every runtime that cannot load `.css` files. For each
 * CSS file `@tsdown/css` emits, this plugin instead:
 *
 * - emits a no-op JS shim (`style.css` -> `style-css.js`) and its `style-css.d.ts` declaration,
 * - writes the `"./style.css"` export to `package.json` (and `publishConfig.exports`) through
 *   tsdown's `exports` feature, conditional with `nodeCompat` so `browser`/`style` resolve to
 *   the stylesheet while `node`/`default` resolve to the shim, and
 * - prepends the self-referential `import "<pkg>/style.css"` to entry chunks that use the CSS,
 *   replacing `@tsdown/css`'s relative injection.
 *
 * @internal
 */
export function cssNodeCompatPlugin(options: CssNodeCompatPluginOptions = {}): TsdownPlugin {
  const {inject, exports: exportsCss, nodeCompat} = resolveCssExportOptions(options)
  const splitting = options.splitting ?? false
  const mergedFileName = options.fileName ?? 'style.css'

  /**
   * The ids of the stylesheet modules in the build, mirroring `@tsdown/css`'s own `styles` map
   * so a chunk's CSS usage can be detected without depending on it. Hosts run one build per
   * output format with a shared plugin instance, so the set is append-only.
   */
  const cssModuleIds = new Set<string>()
  /** The package name, for the self-referential CSS import. */
  let packageName: string | undefined

  /** The CSS file an entry chunk's own styles are emitted to. */
  const cssFileNameFor = (chunkFileName: string): string =>
    splitting ? toCssFileName(chunkFileName) : mergedFileName

  return {
    name: 'sanity-css-node-compat',

    // Injection prepends the import through rolldown's native MagicString
    // (`meta.magicString`), which keeps sourcemaps intact.
    options(inputOptions) {
      if (!inject) return undefined
      return {
        ...inputOptions,
        experimental: {...inputOptions.experimental, nativeMagicString: true},
      }
    },

    // Record the stylesheet modules without transforming them: `@tsdown/css`'s own `transform`
    // hooks do the compiling, and returning `undefined` here leaves their result untouched.
    transform: {
      filter: {id: RE_CSS_LANG},
      handler(_code, id) {
        if (!RE_CSS_INLINE.test(id)) cssModuleIds.add(id)
        return undefined
      },
    },

    // With `exports`, write the `./<cssFileName>` exports to `package.json` (and, through
    // tsdown, to `publishConfig.exports`) by composing into `exports.customExports` before the
    // config is resolved. tsdown's `exports` feature is opt-in, so nothing is written when it
    // is not enabled. Only the merged mode has a statically known file name; with `splitting`
    // the file names follow the chunk names, so those exports are left to the host (which is
    // what `@sanity/pkg-utils` does for its `.css` export subpaths).
    tsdownConfig(config: UserConfig) {
      if (!exportsCss || splitting) return undefined
      const exportsOption = config.exports
      if (!exportsOption) return undefined

      // Normalize the `boolean | CIOption | object` forms of the `exports` option into the
      // object form, preserving the enabled-ness (`true` and bare CI conditions mean enabled)
      const exportsOptions: Extract<NonNullable<UserConfig['exports']>, object> =
        exportsOption === true
          ? {}
          : typeof exportsOption === 'string'
            ? {enabled: exportsOption}
            : exportsOption

      const configOutDir = config.outDir ?? 'dist'
      const cssExport = nodeCompat
        ? createConditionalCssExport(mergedFileName, configOutDir)
        : createCssExport(mergedFileName, configOutDir)
      const previousCustomExports = exportsOptions.customExports
      exportsOptions.customExports = async (exportsMap, context) => {
        // Apply a pre-existing `customExports` first (both its function and record forms,
        // mirroring how tsdown itself applies them), then insert the CSS export
        const base =
          typeof previousCustomExports === 'function'
            ? await previousCustomExports(exportsMap, context)
            : previousCustomExports
              ? {...exportsMap, ...previousCustomExports}
              : exportsMap
        return insertCssExport(base, `./${mergedFileName}`, cssExport)
      }
      config.exports = exportsOptions
      return undefined
    },

    tsdownConfigResolved(config: ResolvedConfig) {
      packageName = config.pkg?.name
    },

    // Inject the CSS import into entry chunks that use CSS: relative by default (like
    // `css.inject` in `@tsdown/css`), or the self-referential bare specifier when the CSS file
    // is published as an export subpath.
    renderChunk(code, chunk, outputOptions, meta) {
      if (!inject || cssModuleIds.size === 0) return undefined
      // The `.d` name / `.d.ts` file checks skip the chunks of tsdown's d.ts passes - they
      // never contain styles.
      if (!chunk.isEntry || chunk.name.endsWith('.d') || RE_DTS.test(chunk.fileName))
        return undefined
      const {format} = outputOptions
      if (format !== 'es' && format !== 'cjs') return undefined
      // In merged mode every stylesheet lands in the same file, so a chunk that reaches CSS
      // through an imported chunk still needs the import. With `splitting` each chunk's CSS
      // goes to its own file, so only the chunk's own modules count - the same condition
      // `@tsdown/css` uses for its relative injection.
      const hasStyles = splitting
        ? chunk.moduleIds.some((id) => cssModuleIds.has(id))
        : chunkHasStyles(chunk, meta.chunks, cssModuleIds)
      if (!hasStyles) return undefined

      const cssFileName = cssFileNameFor(chunk.fileName)
      const specifier = JSON.stringify(
        exportsCss
          ? `${resolvePackageName()}/${cssFileName}`
          : relativeImportPath(chunk.fileName, cssFileName),
      )
      const statement = format === 'cjs' ? `require(${specifier});\n` : `import ${specifier};\n`

      const {magicString} = meta
      if (magicString) {
        magicString.prepend(statement)
        return magicString
      }
      // Fallback when another `options` hook disabled `experimental.nativeMagicString`: the
      // import is still injected, but the chunk's sourcemap can't be adjusted for it.
      if (outputOptions.sourcemap) {
        this.warn(
          `[sanity-css-node-compat] rolldown's native magic-string is unavailable, so the CSS import injected into "${chunk.fileName}" shifts its sourcemap by one line.`,
        )
      }
      return {code: statement + code}
    },

    // Emit a no-op JS shim and its declaration file next to every CSS file `@tsdown/css`
    // emitted, for the `node`/`default` and `types` conditions of the export to point at.
    // `order: 'post'` is required: tsdown registers the `@tsdown/css` output plugins after the
    // user plugins, so the CSS assets only exist in the bundle once they have run.
    generateBundle: {
      order: 'post',
      handler(_outputOptions, bundle) {
        if (!exportsCss) return
        const cssFileNames = Object.values(bundle)
          .filter((asset) => asset.type === 'asset' && RE_CSS_ASSET.test(asset.fileName))
          .map((asset) => asset.fileName)

        // The export is written into `package.json` at config-resolution time, before any CSS
        // is known, so in merged mode the CSS file is emitted even when nothing produced CSS -
        // otherwise the `browser`/`style` conditions would dangle. With `splitting` the file
        // names follow the chunk names, so there is nothing to declare up front.
        if (!splitting && !cssFileNames.includes(mergedFileName)) {
          this.emitFile({type: 'asset', fileName: mergedFileName, source: ''})
          cssFileNames.push(mergedFileName)
        }

        if (!nodeCompat) return
        for (const cssFileName of cssFileNames) {
          const shimFileName = cssShimFileName(cssFileName)
          // Another plugin (`@sanity/vanilla-extract-rolldown-plugin` for `bundle.css`) may
          // already own this CSS file and have emitted its shims.
          if (bundle[shimFileName]) continue
          this.emitFile({
            type: 'asset',
            fileName: shimFileName,
            source: cssShimSource(cssFileName),
          })
          this.emitFile({
            type: 'asset',
            fileName: cssShimDtsFileName(cssFileName),
            source: cssShimDtsSource(cssFileName),
          })
        }
      },
    },
  }

  function resolvePackageName(): string {
    if (!packageName) {
      throw new Error(
        `[sanity-css-node-compat] Unable to resolve the package name from package.json, which is required by \`css.exports\` for the self-referential CSS import. Disable \`css.exports\` (or \`css.inject\`) to wire up the CSS import yourself.`,
      )
    }
    return packageName
  }
}

/** The relative import path from a chunk to a CSS file, like the `css.inject` in `@tsdown/css`. */
function relativeImportPath(chunkFileName: string, cssFileName: string): string {
  const relativePath = path.posix.relative(path.posix.dirname(chunkFileName), cssFileName)
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

/** Whether a chunk (or any chunk it imports, transitively) contains stylesheet modules. */
function chunkHasStyles(
  chunk: {fileName: string; moduleIds: string[]; imports: string[]; dynamicImports: string[]},
  chunks: Record<
    string,
    {fileName: string; moduleIds: string[]; imports: string[]; dynamicImports: string[]}
  >,
  cssModuleIds: ReadonlySet<string>,
): boolean {
  const seen = new Set<string>()
  const queue = [chunk]
  for (let current = queue.pop(); current; current = queue.pop()) {
    if (seen.has(current.fileName)) continue
    seen.add(current.fileName)
    if (current.moduleIds.some((id) => cssModuleIds.has(id))) return true
    for (const imported of [...current.imports, ...current.dynamicImports]) {
      const importedChunk = chunks[imported]
      if (importedChunk) queue.push(importedChunk)
    }
  }
  return false
}
