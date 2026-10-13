/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * babel debug-ID pass (`@vanilla-extract/babel-plugin-debug-ids` +
 * `@babel/plugin-syntax-typescript`) replaced by {@link injectDebugIds} over the oxc-shaped
 * AST from `yuku-parser` (chosen over `rolldown/parseAst` in the bench-off of
 * `bench/debug-ids.bench.ts`: same AST, ~2x faster parse).
 */
import {addFileScope} from './addFileScope.ts'
import {injectDebugIds} from './debugIds.ts'
import {createFileScopePackageName} from './fileScopePackageName.ts'
import type {IdentifierOption} from './types.ts'

/** @public */
export interface TransformParams {
  source: string
  filePath: string
  rootPath: string
  packageName: string
  /**
   * The package version. Together with a digest of `source` it qualifies the file scope's
   * package name, which keeps the generated identifiers unique per package version and
   * module content — see {@link createFileScopePackageName}.
   */
  packageVersion?: string | undefined
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
 * the module with its file scope (and optional global adapter binding). The file scope's
 * package name is qualified with the package version and a digest of the source, so the
 * identifiers `@vanilla-extract/css` derives from it are unique per package build.
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
  packageVersion,
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
    // Digested from the authored source, not the debug-ID-injected code, so the digest is the
    // same for every identifier option
    packageName: createFileScopePackageName({name: packageName, version: packageVersion, source}),
    globalAdapterIdentifier,
  })
}
