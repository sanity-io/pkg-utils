/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * `eval` package replaced by the `node:vm`-based {@link evalModule}.
 */
import type {Adapter, FileScope} from '@vanilla-extract/css'
import {removeAdapter, setAdapter} from '@vanilla-extract/css/adapter'
import {transformCss} from '@vanilla-extract/css/transformCss'
import {evalModule} from './evalModule.ts'
import {parseFileScope, stringifyFileScope} from './fileScope.ts'
import {serializeCss} from './serializeCss.ts'
import {serializeVanillaModule} from './serializeVanillaModule.ts'
import type {IdentifierOption} from './types.ts'

type Css = Parameters<Adapter['appendCss']>[0]
type Composition = Parameters<Adapter['registerComposition']>[0]

const originalNodeEnv = process.env['NODE_ENV']

/** @public */
export interface ProcessVanillaFileOptions {
  source: string
  filePath: string
  outputCss?: boolean
  identOption?: IdentifierOption
  serializeVirtualCssPath?: (file: {
    fileName: string
    fileScope: FileScope
    source: string
  }) => string | Promise<string>
}

/**
 * Evaluates the compiled source of a `.css.ts` module (see {@link compile}) with a collecting
 * CSS adapter, and serializes the result back into an ES module of virtual `.vanilla.css`
 * imports followed by the evaluated exports.
 * @public
 */
export async function processVanillaFile({
  source,
  filePath,
  outputCss = true,
  identOption = process.env['NODE_ENV'] === 'production' ? 'short' : 'debug',
  serializeVirtualCssPath,
}: ProcessVanillaFileOptions): Promise<string> {
  const cssByFileScope = new Map<string, Array<Css>>()
  const localClassNames = new Set<string>()
  const composedClassLists: Array<Composition> = []
  const usedCompositions = new Set<string>()

  const cssAdapter: Adapter = {
    appendCss: (css, fileScope) => {
      if (outputCss) {
        const serialisedFileScope = stringifyFileScope(fileScope)
        const fileScopeCss = cssByFileScope.get(serialisedFileScope) ?? []

        fileScopeCss.push(css)

        cssByFileScope.set(serialisedFileScope, fileScopeCss)
      }
    },
    registerClassName: (className) => {
      localClassNames.add(className)
    },
    registerComposition: (composedClassList) => {
      composedClassLists.push(composedClassList)
    },
    markCompositionUsed: (identifier) => {
      usedCompositions.add(identifier)
    },
    onEndFileScope: () => {},
    getIdentOption: () => identOption,
  }

  const currentNodeEnv = process.env['NODE_ENV']

  // Vite sometimes modifies NODE_ENV which causes different versions (e.g. dev/prod) of vanilla
  // packages to be loaded. This can cause CSS to be bound to the wrong instance, resulting in no
  // CSS output. To get around this we set the NODE_ENV back to the original value ONLY during eval.
  process.env['NODE_ENV'] = originalNodeEnv

  const adapterBoundSource = `
    const { setAdapter, removeAdapter } = require('@vanilla-extract/css/adapter');
    setAdapter(__adapter__);
    ${source}
    // Backwards compat with older versions of @vanilla-extract/css
    if (removeAdapter) {
      removeAdapter();
    }
  `

  const evalResult = evalModule(adapterBoundSource, filePath, {
    console,
    process,
    __adapter__: cssAdapter,
  })

  process.env['NODE_ENV'] = currentNodeEnv

  const cssImports: string[] = []

  for (const [serialisedFileScope, fileScopeCss] of cssByFileScope) {
    const fileScope = parseFileScope(serialisedFileScope)

    setAdapter(cssAdapter)

    const css = transformCss({
      localClassNames: Array.from(localClassNames),
      composedClassLists,
      cssObjs: fileScopeCss,
    }).join('\n')

    removeAdapter()

    const fileName = `${fileScope.filePath}.vanilla.css`

    let virtualCssFilePath: string

    if (serializeVirtualCssPath) {
      const serializedResult = serializeVirtualCssPath({fileName, fileScope, source: css})
      virtualCssFilePath =
        typeof serializedResult === 'string' ? serializedResult : await serializedResult
    } else {
      const serializedCss = await serializeCss(css)
      virtualCssFilePath = `import '${fileName}?source=${serializedCss}';`
    }

    cssImports.push(virtualCssFilePath)
  }

  const unusedCompositions = composedClassLists
    .filter(({identifier}) => !usedCompositions.has(identifier))
    .map(({identifier}) => identifier)

  const unusedCompositionRegex =
    unusedCompositions.length > 0 ? RegExp(`(${unusedCompositions.join('|')})\\s`, 'g') : null

  return serializeVanillaModule(cssImports, evalResult, unusedCompositionRegex)
}
