import {hash} from './hash.ts'
import type {IdentifierOption} from './types.ts'

/** @public */
export interface FileScopePackageNameParams {
  /** The package name (`name` in `package.json`). */
  name: string
  /** The package version (`version` in `package.json`), when it has one. */
  version?: string | undefined
  /** The source of the `.css.ts` module, as loaded by the bundler. */
  source: string
}

/** The parts of a {@link createFileScopePackageName | file-scope package name}. */
export interface ParsedFileScopePackageName {
  name: string
  version?: string
  digest?: string
}

/** The length of the hex source digest in a file-scope package name. */
const DIGEST_LENGTH = 8

/**
 * The `packageName` a `.css.ts` module's file scope is set to: the package name qualified by
 * the package version and a digest of the module source, e.g. `@sanity/ui@4.4.4+1f3a9c2e`
 * (`version` falls back to `0.0.0`, as the version of a package without one).
 *
 * `@vanilla-extract/css` derives every identifier it generates — class names, keyframes, CSS
 * vars, containers, layers — from `hash(packageName + filePath)` followed by a per-file call
 * counter. With a bare package name, the identifiers of a `.css.ts` module are therefore the
 * same in every version of the package: once a style is added, removed or reordered, the
 * counter shifts and a class name that used to select one rule selects another. Two versions
 * of the same library on one page (an app bundling its own `@sanity/ui` next to a Studio loaded
 * from the module CDN) then style each other's markup with the wrong rules — the SAPP-4639
 * outage, where `@sanity/ui`'s `_2mi48t0` turned from the Button's loading overlay into its
 * root class and every Button became an opaque box.
 *
 * Qualifying the name with the version makes the identifiers of every published version
 * distinct; the source digest does the same for builds of the same version with different
 * styles (local or preview builds, or packages without a version). Identical name, version and
 * source still produce identical identifiers (the digest ignores line endings, so a CRLF
 * checkout builds the same identifiers as an LF one), and since the hash output has a fixed
 * 32-bit width (`@emotion/hash`, base36 encoded), the identifiers stay as short as before.
 * @public
 */
export function createFileScopePackageName({
  name,
  version = '0.0.0',
  source,
}: FileScopePackageNameParams): string {
  const digest = hash(source.replaceAll('\r\n', '\n')).slice(0, DIGEST_LENGTH)
  return `${name}@${version}+${digest}`
}

/**
 * Splits a {@link createFileScopePackageName | file-scope package name} back into its parts. A
 * bare package name (e.g. from a `.css.ts` module whose file scope was set by another tool)
 * parses to just its `name`.
 * @public
 */
export function parseFileScopePackageName(packageName: string): ParsedFileScopePackageName {
  // The digest follows the last `+` (a version may carry `+build` metadata of its own) and the
  // version the first `@` after the scope. Neither character is valid in a package name.
  const digestIndex = packageName.lastIndexOf('+')
  const spec = digestIndex === -1 ? packageName : packageName.slice(0, digestIndex)
  const versionIndex = spec.indexOf('@', 1)
  const name = versionIndex === -1 ? spec : spec.slice(0, versionIndex)

  return {
    name,
    ...(versionIndex === -1 ? {} : {version: spec.slice(versionIndex + 1)}),
    ...(digestIndex === -1 ? {} : {digest: packageName.slice(digestIndex + 1)}),
  }
}

/**
 * The identifier option a compilation adapter returns from `getIdentOption`. A custom
 * identifier function keeps receiving the bare package name, as with upstream vanilla-extract:
 * the version and digest qualifying the file scope (see {@link createFileScopePackageName})
 * already feed into the `hash` it receives, and a `packageName` with `@`/`+`/`.` in it would
 * break functions that format the name into their identifiers.
 * @public
 */
export function createAdapterIdentOption(identOption: IdentifierOption): IdentifierOption {
  if (typeof identOption !== 'function') return identOption

  return (params) =>
    identOption(
      params.packageName === undefined
        ? params
        : {...params, packageName: parseFileScopePackageName(params.packageName).name},
    )
}
