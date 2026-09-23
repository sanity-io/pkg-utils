/**
 * The evaluation step of upstream `processVanillaFile` (`@vanilla-extract/integration`, MIT
 * licensed, Copyright (c) 2021 SEEK), split out so both the per-module {@link processVanillaFile}
 * and the whole-program {@link processVanillaProgram} share it: runs compiled CommonJS with a
 * collecting adapter and returns everything the adapter saw, per file scope, in evaluation order.
 */
import type {Adapter} from '@vanilla-extract/css'
import {evalModule} from './evalModule.ts'
import {stringifyFileScope} from './fileScope.ts'
import type {Composition, CSS} from './transformCss/types.ts'
import type {IdentifierOption} from './types.ts'

const originalNodeEnv = process.env['NODE_ENV']

/** @public */
export interface EvaluateVanillaModuleOptions {
  /** Compiled CommonJS source of the module graph, see {@link compile}. */
  source: string
  /** The path the source is evaluated as (`require()` resolves from its directory). */
  filePath: string
  identOption: IdentifierOption
  /**
   * Whether to collect CSS at all. `false` skips collecting (the exports are still evaluated),
   * for callers that only need the serialized module.
   * @defaultValue true
   */
  outputCss?: boolean
}

/** @public */
export interface EvaluatedVanillaModule {
  /** The module's evaluated exports (class name strings, recipes, theme contracts, ...). */
  exports: Record<string, unknown>
  /**
   * The CSS objects appended by every file scope in the graph, keyed by the serialized file
   * scope (see {@link stringifyFileScope}), in the order the scopes first appended CSS —
   * dependencies before the modules importing them.
   */
  cssByFileScope: Map<string, Array<CSS>>
  /** Every class name registered by any file scope in the graph. */
  localClassNames: Set<string>
  /** Every class list composition registered by any file scope in the graph. */
  composedClassLists: Array<Composition>
  /** Composition identifiers referenced by a selector during evaluation (`markCompositionUsed`). */
  usedCompositions: Set<string>
}

/**
 * Evaluates compiled `.css.ts` source with a collecting CSS adapter bound to the module's own
 * `@vanilla-extract/css` instance.
 * @public
 */
export function evaluateVanillaModule({
  source,
  filePath,
  identOption,
  outputCss = true,
}: EvaluateVanillaModuleOptions): EvaluatedVanillaModule {
  const cssByFileScope = new Map<string, Array<CSS>>()
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

  let exports: Record<string, unknown>
  try {
    exports = evalModule(adapterBoundSource, filePath, {
      console,
      process,
      __adapter__: cssAdapter,
    })
  } finally {
    process.env['NODE_ENV'] = currentNodeEnv
  }

  return {exports, cssByFileScope, localClassNames, composedClassLists, usedCompositions}
}
