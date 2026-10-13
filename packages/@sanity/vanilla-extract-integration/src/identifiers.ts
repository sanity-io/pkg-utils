import murmurHash from '@emotion/hash'
import {getPackageInfo} from './packageInfo.ts'
import type {IdentifierOption, PluginIdentifierOption} from './types.ts'

type CustomIdentifierFunction = Exclude<IdentifierOption, string>

/**
 * `'short'` identifiers with the package version in the file-scope hash: vanilla-extract hashes
 * `packageName + filePath` and appends the base-36 count of the identifiers generated in the
 * file so far, so a release that reorders a module's styles reuses its class names for
 * different rules. This hashes `packageName + '@' + packageVersion + filePath` instead, keeping
 * the counter and the `_` prefix of names that start with a digit.
 */
function safeIdentifiers(packageVersion: string): CustomIdentifierFunction {
  return ({hash, filePath, packageName}) => {
    // `hash` is the `'short'` identifier before its `_` prefix: the file-scope hash, then the
    // counter
    const fileScopeHash = murmurHash(packageName ? `${packageName}${filePath}` : filePath)
    if (!hash.startsWith(fileScopeHash)) {
      throw new Error(
        `[vanilla-extract] Unexpected identifier hash "${hash}" for "${filePath}": \`identifiers: 'safe'\` expects \`@vanilla-extract/css\` to hash file scopes with \`@emotion/hash\`.`,
      )
    }
    const counter = hash.slice(fileScopeHash.length)
    const identifier = `${murmurHash(`${packageName ?? ''}@${packageVersion}${filePath}`)}${counter}`
    return /^[0-9]/.test(identifier) ? `_${identifier}` : identifier
  }
}

/**
 * Resolves the plugins' `identifiers` option into the {@link IdentifierOption} that
 * {@link compile} and {@link processVanillaFile} evaluate with. `'safe'` becomes a custom
 * identifier function hashing in the `version` of the nearest `package.json` from `cwd` — the
 * same lookup ({@link getPackageInfo}) that names the file scopes. Every other value passes
 * through.
 * @public
 */
export function resolveIdentifierOption(
  identifiers: PluginIdentifierOption,
  cwd: string,
): IdentifierOption {
  if (identifiers !== 'safe') return identifiers

  const packageInfo = getPackageInfo(cwd)
  if (!packageInfo.version) {
    throw new Error(
      `[vanilla-extract] \`identifiers: 'safe'\` hashes the package version into identifiers, but ${packageInfo.path} has no \`version\`.`,
    )
  }
  return safeIdentifiers(packageInfo.version)
}
