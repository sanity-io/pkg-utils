/**
 * Whole-program counterpart of {@link processVanillaFile}: every `.css.ts` module of a project
 * is compiled, evaluated and rendered once. The modules share one adapter (so one set of local
 * class names and compositions), one `Stylesheet` (so one rule order — dependencies first, then
 * discovery order — with all conditional blocks after all unconditional rules), and each module
 * still serializes to today's per-module ES module shape from its own namespace.
 */
import path from 'node:path'
import type {FileScope} from '@vanilla-extract/css'
import type {AtomicReport} from './atomic/atomicPass.ts'
import {compileProgram} from './compile.ts'
import {evaluateVanillaModule} from './evaluateVanillaModule.ts'
import {parseFileScope} from './fileScope.ts'
import {serializeVanillaModule} from './serializeVanillaModule.ts'
import {renderStylesheet} from './transformCss/transformCss.ts'
import type {CSS} from './transformCss/types.ts'
import {toRecord} from './transformCss/utils.ts'
import type {IdentifierOption} from './types.ts'

/** @public */
export interface ProcessVanillaProgramOptions {
  /** Absolute paths of the `.css.ts` modules that make up the program. */
  filePaths: ReadonlyArray<string>
  /**
   * The project root: the child compilation's working directory, the location `require()`
   * resolves the externalized `@vanilla-extract/*` packages from, and the root the file scopes
   * are relative to.
   * @defaultValue `process.cwd()`
   */
  cwd?: string
  identOption?: IdentifierOption
  /**
   * The import statement(s) prepended to every module's serialized source, e.g. the import of
   * the virtual module carrying the program's CSS. Nothing is prepended by default: unlike
   * {@link processVanillaFile}, the CSS is returned out-of-band rather than embedded in a
   * `?source=` specifier, since it is shared by every module.
   */
  cssImports?: ReadonlyArray<string>
  /**
   * Enables the atomic pass over the whole program: identical declarations are shared across
   * every module wherever that cannot change what an element renders as, and every module's
   * exported class lists are expanded with the atomic classes (identity class first).
   * @defaultValue false
   */
  atomic?: boolean
}

/** @public */
export interface ProcessedVanillaProgram {
  /** The program's CSS: one `Stylesheet` over every file scope, rules joined by newlines. */
  css: string
  /**
   * The serialized ES module source of every module in `filePaths`, keyed by normalized
   * absolute path (POSIX separators).
   */
  modules: ReadonlyMap<string, string>
  /** The file scopes that produced CSS, in program (rendering) order. */
  fileScopes: ReadonlyArray<FileScope>
  /** The CSS objects each file scope produced, in program order, for callers that post-process. */
  cssByFileScope: ReadonlyMap<string, ReadonlyArray<CSS>>
  /** Every file the program depends on (the child compilation's module ids). */
  watchFiles: string[]
  /**
   * The files each module in `filePaths` (transitively) imports, by normalized absolute path.
   * A `.css.ts` module that only other `.css.ts` modules import never surfaces in the host
   * bundler's graph (the serialized modules don't import each other), so this is how to tell
   * it is reached.
   */
  dependencies: ReadonlyMap<string, ReadonlySet<string>>
  /** The atomic pass's statistics, when `atomic` is enabled. */
  atomicReport: AtomicReport | undefined
}

/**
 * Compiles, evaluates and renders a set of `.css.ts` modules as one program. See the module
 * documentation for how this differs from calling {@link processVanillaFile} per module.
 * @public
 */
export async function processVanillaProgram({
  filePaths,
  cwd = process.cwd(),
  identOption = process.env['NODE_ENV'] === 'production' ? 'short' : 'debug',
  cssImports = [],
  atomic = false,
}: ProcessVanillaProgramOptions): Promise<ProcessedVanillaProgram> {
  const {source, namespaces, watchFiles, dependencies} = await compileProgram({
    filePaths,
    identOption,
    cwd,
  })

  const {exports, cssByFileScope, localClassNames, composedClassLists, usedCompositions} =
    evaluateVanillaModule({
      source,
      // Externals (`@vanilla-extract/*`) resolve from the project root, like the modules' own
      // `require()` calls would from a file at that location
      filePath: path.join(cwd, '__vanilla-extract-program__.css.js'),
      identOption,
    })

  const cssObjs: Array<CSS> = []
  const fileScopes: Array<FileScope> = []
  for (const [serialisedFileScope, fileScopeCss] of cssByFileScope) {
    fileScopes.push(parseFileScope(serialisedFileScope))
    cssObjs.push(...fileScopeCss)
  }

  const rendered = renderStylesheet({
    localClassNames: Array.from(localClassNames),
    composedClassLists,
    cssObjs,
    onCompositionUsed: (identifier) => usedCompositions.add(identifier),
    // One scope for the whole program: the classes are shared across every module
    ...(atomic ? {atomic: {scopeKey: 'program', identOption}} : {}),
  })
  const css = rendered.css.join('\n')

  const unusedCompositions = composedClassLists
    .filter(({identifier}) => !usedCompositions.has(identifier))
    .map(({identifier}) => identifier)

  const unusedCompositionRegex =
    unusedCompositions.length > 0 ? RegExp(`(${unusedCompositions.join('|')})\\s`, 'g') : null

  const modules = new Map<string, string>()
  for (const [filePath, namespace] of namespaces) {
    const moduleExports = exports[namespace]
    if (typeof moduleExports !== 'object' || moduleExports === null) {
      throw new Error(`[vanilla-extract] The compiled program has no namespace for ${filePath}`)
    }
    modules.set(
      filePath,
      serializeVanillaModule(
        [...cssImports],
        // Namespace objects expose their exports as enumerable getters
        {...toRecord(moduleExports)},
        unusedCompositionRegex,
        atomic ? {localClassNames, expansions: rendered.expansions} : undefined,
      ),
    )
  }

  return {
    css,
    modules,
    fileScopes,
    cssByFileScope,
    watchFiles,
    dependencies,
    atomicReport: rendered.report,
  }
}
