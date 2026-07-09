import type ts from '@typescript/typescript6'

/**
 * The classic TypeScript JS compiler API namespace (`ts.sys`, `ts.createProgram`, etc), typed
 * through the `@typescript/typescript6` compat package so the types stay available when the
 * installed `typescript` is v7 (the Go-native compiler, which only exports `version` and
 * `versionMajorMinor` from its main entry point).
 * @internal
 */
export type TSCompilerApi = typeof ts

let compilerApi: Promise<TSCompilerApi> | undefined

async function importCompilerApi(): Promise<TSCompilerApi> {
  const installed = await import('typescript')
  // oxlint-disable-next-line no-unsafe-type-assertion -- typescript v7 types its main entry as version-only exports, while v5 and v6 expose the full compiler API
  const candidate = (installed.default ?? installed) as unknown as Partial<TSCompilerApi>

  if (typeof candidate.parseJsonConfigFileContent === 'function' && candidate.sys) {
    // oxlint-disable-next-line no-unsafe-type-assertion -- narrowed above by checking for compiler API entry points
    return candidate as TSCompilerApi
  }

  // TypeScript 7+ no longer ships the JS compiler API, so fall back to the official
  // `@typescript/typescript6` compat package, which re-exports the TypeScript 6 API
  const compat = await import('@typescript/typescript6')
  return compat.default ?? compat
}

/**
 * Loads the TypeScript JS compiler API from the installed `typescript` package, falling back to
 * `@typescript/typescript6` when the installed version doesn't provide it (TypeScript 7+).
 * @internal
 */
export function getCompilerApi(): Promise<TSCompilerApi> {
  compilerApi ??= importCompilerApi()
  return compilerApi
}
