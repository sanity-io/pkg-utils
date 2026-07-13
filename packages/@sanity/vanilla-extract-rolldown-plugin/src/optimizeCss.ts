import {basename} from 'node:path'
import browserslist from 'browserslist'
import {browserslistToTargets, transform} from 'lightningcss'
import type {OutputAsset, Plugin} from 'rolldown'

/**
 * Post-processes the extracted CSS asset with `lightningcss`, applying browserslist targets and
 * (unless disabled) minification. Ported from the equivalent `@sanity/pkg-utils` Rollup plugin.
 * @internal
 */
export function optimizeCss(options: {
  extractFileName: string
  browserslist: string | string[]
  minify: boolean
}): Plugin {
  return {
    name: 'vanilla-extract:optimize-css',

    async generateBundle(_outputOptions, bundle, _isWrite) {
      for (const [fileName, assetOrChunk] of Object.entries(bundle)) {
        // find the extracted CSS asset
        if (assetOrChunk.type === 'asset') {
          const asset = assetOrChunk
          if (
            asset.fileName === options.extractFileName ||
            asset.originalFileNames.includes(options.extractFileName)
          ) {
            const sourceMap = bundle[`${fileName}.map`]
            await transformCss(
              asset,
              sourceMap?.type === 'asset' ? sourceMap : undefined,
              options.browserslist,
              options.minify,
            )
          }
        }
      }
    },
  }
}

async function transformCss(
  asset: OutputAsset,
  sourceMapAsset: OutputAsset | undefined,
  browserslistConfig: string | string[],
  minify: boolean,
) {
  const css = asset.source.toString()
  const file = asset.fileName

  const targets = browserslistToTargets(browserslist(browserslistConfig))

  // process (and, unless disabled, minify) css using lightningcss
  const lightningCssResult = transform({
    filename: file,
    code: Buffer.from(css),
    minify,
    cssModules: false,
    targets,
    sourceMap: !!sourceMapAsset,
    inputSourceMap: sourceMapAsset ? sourceMapAsset.source.toString() : undefined,
  })

  if (lightningCssResult.warnings.length) {
    console.warn(lightningCssResult.warnings)
  }

  asset.source = new TextDecoder().decode(lightningCssResult.code)
  if (sourceMapAsset && lightningCssResult.map) {
    sourceMapAsset.source = new TextDecoder().decode(lightningCssResult.map)
    asset.source += `\n/*# sourceMappingURL=${basename(sourceMapAsset.fileName)}*/\n`
  }
}
