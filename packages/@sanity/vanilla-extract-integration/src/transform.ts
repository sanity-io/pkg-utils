/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * babel debug-ID pass (`@vanilla-extract/babel-plugin-debug-ids` +
 * `@babel/plugin-syntax-typescript`) replaced by {@link injectDebugIds} over the oxc-shaped
 * AST from `yuku-parser` (chosen over `rolldown/parseAst` in the bench-off of
 * `bench/debug-ids.bench.ts`: same AST, ~2x faster parse).
 */
import {addFileScope} from './addFileScope.ts'
import {injectDebugIds} from './debugIds.ts'
import type {IdentifierOption} from './types.ts'

/** @public */
export interface TransformParams {
  source: string
  filePath: string
  rootPath: string
  packageName: string
  identOption: IdentifierOption
  globalAdapterIdentifier?: string
}

/** The parser `lang` for a module id, mirroring how the file would be loaded by the bundler. */
function langFromPath(filePath: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  if (filePath.endsWith('.tsx')) return 'tsx'
  if (filePath.endsWith('.ts')) return 'ts'
  if (filePath.endsWith('.jsx')) return 'jsx'
  return 'js'
}

/**
 * Prepares a `.css.ts` module's source for evaluation: injects debug IDs (only when
 * `identOption` is `'debug'` — `'short'` production builds skip the parse entirely) and wraps
 * the module with its file scope (and optional global adapter binding).
 *
 * The parser is lazy-loaded so its native binding only loads once a module is actually
 * transformed with debug identifiers.
 * @public
 */
export async function transform({
  source,
  filePath,
  rootPath,
  packageName,
  identOption,
  globalAdapterIdentifier,
}: TransformParams): Promise<string> {
  let code = source

  if (identOption === 'debug') {
    const {parse} = await import('yuku-parser')
    // `preserveParens: false` matches the AST shape babel produced for the upstream plugin.
    // yuku is error-tolerant (it always produces an AST), so syntactically broken sources pass
    // through best-effort here and fail in the bundler's own parse with its proper diagnostics.
    const {program} = parse(code, {lang: langFromPath(filePath), preserveParens: false})
    code = injectDebugIds(code, program)
  }

  return addFileScope({
    source: code,
    filePath,
    rootPath,
    packageName,
    globalAdapterIdentifier,
  })
}
