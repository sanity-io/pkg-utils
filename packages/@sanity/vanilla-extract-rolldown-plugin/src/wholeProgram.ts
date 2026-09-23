import path from 'node:path'
import {
  discoverCssModules,
  type IdentifierOption,
  type ProcessedVanillaProgram,
} from '@sanity/vanilla-extract-integration'

/**
 * The specifier every module of a whole-program compilation imports for the program's CSS, and
 * the virtual module id it resolves to (kept out of CSS pipelines like the per-module ids, see
 * the `resolveId` hook).
 */
export const PROGRAM_CSS_SPECIFIER = 'virtual:vanilla-extract-program.vanilla.css'
export const PROGRAM_CSS_SPECIFIER_FILTER: RegExp =
  /^virtual:vanilla-extract-program\.vanilla\.css$/
export const PROGRAM_CSS_MODULE_ID = '\0vanilla-extract-program.vanilla.js'

/** The absolute paths of the entry files in a normalized rolldown `input` option. */
export function inputEntryFiles(input: string[] | Record<string, string>, cwd: string): string[] {
  const entries = Array.isArray(input) ? input : Object.values(input)
  // Virtual ids (`\0…`, `virtual:…`) aren't files; a Windows drive letter (`C:\…`) also looks
  // like a scheme, but is an absolute path
  return entries
    .filter(
      (entry) => !entry.startsWith('\0') && (path.isAbsolute(entry) || !/^[a-z]+:/i.test(entry)),
    )
    .map((entry) => path.resolve(cwd, entry))
}

/**
 * The directories scanned for `.css.ts` modules when no `roots` are configured: the directories
 * of the entry files, minus any nested inside another.
 */
export function defaultProgramRoots(entryFiles: ReadonlyArray<string>): string[] {
  const directories = Array.from(new Set(entryFiles.map((file) => path.dirname(file)))).toSorted(
    (a, b) => a.localeCompare(b),
  )
  return directories.filter(
    (directory) =>
      !directories.some(
        (other) => other !== directory && directory.startsWith(`${other}${path.sep}`),
      ),
  )
}

/** A whole-program compilation plus the bookkeeping the plugin hooks need around it. */
export interface WholeProgram {
  /** The module set the program was compiled from. */
  filePaths: ReadonlyArray<string>
  program: ProcessedVanillaProgram
  /** Modules the bundler actually transformed (to warn about discovered-but-unreached ones). */
  served: Set<string>
}

/**
 * Memoizes the whole-program compilation across the builds a host runs with one plugin instance
 * (tsdown runs one per output format): the same root set and identifiers reuse the in-flight or
 * finished program until {@link ProgramCache.invalidate} (a watched file changed).
 */
export class ProgramCache {
  #key: string | undefined
  #promise: Promise<WholeProgram> | undefined

  get(
    roots: ReadonlyArray<string>,
    options: {cwd: string; identOption: IdentifierOption},
    compile: (filePaths: string[]) => Promise<ProcessedVanillaProgram>,
  ): Promise<WholeProgram> {
    const key = JSON.stringify([roots, options.cwd, options.identOption])
    if (this.#promise && this.#key === key) return this.#promise

    const promise = discoverCssModules(roots).then(async (filePaths) => ({
      filePaths,
      program: await compile(filePaths),
      served: new Set<string>(),
    }))
    this.#key = key
    this.#promise = promise
    // A failed compilation is not cached, so the next build retries it
    promise.catch(() => {
      if (this.#promise === promise) this.invalidate()
    })
    return promise
  }

  invalidate(): void {
    this.#key = undefined
    this.#promise = undefined
  }
}
