/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * babel debug-ID pass (`@vanilla-extract/babel-plugin-debug-ids` +
 * `@babel/plugin-syntax-typescript`) replaced by {@link injectDebugIds} over the oxc-shaped
 * AST from `yuku-parser` (chosen over `rolldown/parseAst` in the bench-off of
 * `bench/debug-ids.bench.ts`: same AST, ~2x faster parse).
 */
import {addFileScope} from './addFileScope.ts'
import {injectDebugIds} from './debugIds.ts'
import {hash} from './hash.ts'
import type {IdentifierOption} from './types.ts'

/** @public */
export interface TransformParams {
  source: string
  filePath: string
  rootPath: string
  packageName: string
  /**
   * The version of {@link TransformParams.packageName | `packageName`}'s package, used to salt
   * the file scope (see {@link resolveScopedPackageName}). Callers that resolve the package
   * with {@link getPackageInfo} should forward its `version`; when omitted the file scope is
   * still salted with the module's content hash, but not with a version.
   */
  packageVersion?: string
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
 * Qualifies a file scope's package name with the package version and a content hash of the
 * `.css.ts` module's source, so the class-name hash vanilla-extract derives from the file
 * scope (`murmur(packageName + filePath)` plus a per-file index) can no longer collide across
 * package versions or across different style content (SAPP-4639: `@sanity/ui` 4.4.3/4.4.4
 * shipped identical class names with renumbered meanings, so old CSS styled new markup when
 * both versions shared a page).
 *
 * The result is `${packageName}@${packageVersion}#${contentHash}` (`@<version>` omitted when
 * no version is known). The version is the package's own `version` field; the content hash is
 * 8 hex chars of md5 over the module source with line endings normalized, so CRLF/LF
 * checkouts of the same file scope identically. Debug identifiers are injected after the salt
 * is computed, so `short` and `debug` builds of the same module share the hash.
 * @internal
 */
export function resolveScopedPackageName(
  packageName: string,
  packageVersion: string | undefined,
  source: string,
): string {
  const versioned = packageVersion ? `${packageName}@${packageVersion}` : packageName
  const contentHash = hash(source.replace(/\r\n/g, '\n')).slice(0, 8)
  return `${versioned}#${contentHash}`
}

/**
 * Prepares a `.css.ts` module's source for evaluation: injects debug IDs (only when
 * `identOption` is `'debug'` — `'short'` production builds skip the parse entirely) and wraps
 * the module with its version- and content-salted file scope (and optional global adapter
 * binding).
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
  // Salt from the authored source, before debug IDs are injected, so `short` and `debug`
  // builds of the same module share the file-scope hash (as they did before salting)
  const scopedPackageName = resolveScopedPackageName(packageName, packageVersion, source)
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
    packageName: scopedPackageName,
    globalAdapterIdentifier,
  })
}
