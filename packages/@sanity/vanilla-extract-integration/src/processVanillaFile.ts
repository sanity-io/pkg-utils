/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * `eval` package replaced by the `node:vm`-based {@link evalModule} (through
 * {@link evaluateVanillaModule}), and the CSS rendered by the vendored {@link renderStylesheet}
 * (which takes the composition-usage callback directly instead of reading it off the adapter
 * global, so no `setAdapter`/`removeAdapter` dance is needed around the render) — optionally
 * with the atomic pass.
 */
import type {FileScope} from '@vanilla-extract/css'
import type {AtomicReport} from './atomic/atomicPass.ts'
import {evaluateVanillaModule} from './evaluateVanillaModule.ts'
import {parseFileScope} from './fileScope.ts'
import {serializeCss} from './serializeCss.ts'
import {serializeVanillaModule} from './serializeVanillaModule.ts'
import {renderStylesheet} from './transformCss/transformCss.ts'
import type {IdentifierOption} from './types.ts'

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
  /**
   * Enables the atomic pass: the declarations of `style()` rules are rendered as shared
   * single-declaration classes wherever that cannot change what an element renders as, and the
   * exported class lists are expanded with them (identity class first). Each file scope is
   * rendered on its own, so classes are shared within a file scope.
   * @defaultValue false
   */
  atomic?: boolean
  /** Receives the atomic pass's statistics for every rendered file scope. */
  onAtomicReport?: (report: AtomicReport, fileScope: FileScope) => void
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
  atomic = false,
  onAtomicReport,
}: ProcessVanillaFileOptions): Promise<string> {
  const {exports, cssByFileScope, localClassNames, composedClassLists, usedCompositions} =
    evaluateVanillaModule({source, filePath, identOption, outputCss})

  const cssImports: string[] = []
  const expansions = new Map<string, ReadonlyArray<string>>()

  for (const [serialisedFileScope, fileScopeCss] of cssByFileScope) {
    const fileScope = parseFileScope(serialisedFileScope)

    const rendered = renderStylesheet({
      localClassNames: Array.from(localClassNames),
      composedClassLists,
      cssObjs: fileScopeCss,
      onCompositionUsed: (identifier) => usedCompositions.add(identifier),
      ...(atomic ? {atomic: {scopeKey: serialisedFileScope, identOption, fileScope}} : {}),
    })
    const css = rendered.css.join('\n')
    for (const [identity, atomicClasses] of rendered.expansions) {
      expansions.set(identity, atomicClasses)
    }
    if (rendered.report) onAtomicReport?.(rendered.report, fileScope)

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

  return serializeVanillaModule(
    cssImports,
    exports,
    unusedCompositionRegex,
    atomic ? {localClassNames, expansions} : undefined,
  )
}
