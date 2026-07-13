/**
 * The core plugin is a port of `@vanilla-extract/rollup-plugin`
 * (https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin),
 * MIT licensed, Copyright (c) 2021 SEEK, typed against rolldown's native plugin API and using
 * plugin hook filters (https://github.com/vanilla-extract-css/vanilla-extract/issues/1641) so
 * rolldown skips the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related.
 */
import {
  compile,
  cssFileFilter,
  getSourceFromVirtualCssFile,
  processVanillaFile,
  virtualCssFileFilter,
  type IdentifierOption,
} from '@vanilla-extract/integration'
import type {Plugin} from 'rolldown'
import {generateCssBundle, stripSideEffectImportsMatching} from './lib.ts'

/** @internal */
export interface ExtractPluginOptions {
  identifiers: IdentifierOption
  /** Name of the emitted `.css` asset. */
  name: string
  /** Whether to emit a `.css.map` asset next to the CSS. */
  sourcemap: boolean
}

/**
 * Compiles `.css.ts` modules and extracts their CSS into a single asset:
 *
 * - `transform` compiles each `.css.ts` module to plain JS, leaving a side-effect import of a
 *   virtual `.vanilla.css` module carrying the generated CSS.
 * - `resolveId` resolves those virtual modules as external, stashing the CSS in the module `meta`
 *   and marking the imports side-effect free, so they tree-shake away once the CSS is extracted.
 * - `buildEnd` walks the module graph to bundle the CSS in import order and emits the `.css`
 *   asset (and its sourcemap). It can't happen earlier because the graph hasn't settled yet.
 * - `generateBundle` strips any leftover side-effect imports of the extracted CSS modules.
 *
 * @internal
 */
export function extractPlugin(options: ExtractPluginOptions): Plugin {
  const {identifiers, name, sourcemap} = options
  const cwd = process.cwd()

  let extractedCssIds = new Set<string>()

  return {
    name: 'vanilla-extract',

    buildStart() {
      extractedCssIds = new Set() // refresh every build
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

    // Resolve the virtual .vanilla.css modules to external ids carrying the CSS in `meta`
    resolveId: {
      filter: {id: virtualCssFileFilter},
      async handler(id) {
        const {fileName, source} = await getSourceFromVirtualCssFile(id)
        return {
          id: fileName,
          external: true,
          // The CSS is extracted into a single asset, which makes the side-effect-only imports of
          // the virtual modules redundant, so let tree-shaking drop them up front. The upstream
          // rollup plugin instead strips them from the rendered chunks in `generateBundle`, which
          // minifier statement merging can defeat (e.g. `a(), require("….vanilla.css")` in CJS).
          moduleSideEffects: false,
          meta: {css: source},
        }
      },
    },

    // Generate the extracted CSS bundle
    buildEnd() {
      const {bundle, extractedCssIds: extractedIds} = generateCssBundle(this)
      extractedCssIds = extractedIds
      this.emitFile({
        type: 'asset',
        name,
        originalFileName: name,
        source: bundle.toString(),
      })
      if (sourcemap) {
        const sourcemapName = `${name}.map`
        this.emitFile({
          type: 'asset',
          name: sourcemapName,
          originalFileName: sourcemapName,
          source: bundle.generateMap({file: name, includeContent: true}).toString(),
        })
      }
    },

    // Remove side effect imports of the extracted CSS modules that survived tree-shaking
    generateBundle(_options, bundle) {
      for (const [id, chunk] of Object.entries(bundle)) {
        const isJsFile = /\.(m|c)?js$/.test(id)
        if (
          chunk.type === 'chunk' &&
          isJsFile &&
          chunk.imports.some((specifier) => extractedCssIds.has(specifier))
        ) {
          chunk.code = stripSideEffectImportsMatching(chunk.code, [...extractedCssIds])
        }
      }
    },
  }
}
