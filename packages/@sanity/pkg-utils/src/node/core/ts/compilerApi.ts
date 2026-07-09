import type ts from '@typescript/typescript6'

/**
 * The classic TypeScript JS compiler API namespace (`ts.sys`, `ts.createProgram`, etc), provided
 * by the official `@typescript/typescript6` compat package. `@sanity/pkg-utils` ships its own
 * TypeScript toolchain instead of using the consumer's `typescript` install: the JS compiler API
 * comes from `@typescript/typescript6` (TypeScript 7, the Go-native compiler, no longer ships it),
 * and the Go-native compiler used by `dts: 'rolldown'` comes from the bundled `typescript` v7
 * dependency.
 * @internal
 */
export type TSCompilerApi = typeof ts

let compilerApi: Promise<TSCompilerApi> | undefined

async function importCompilerApi(): Promise<TSCompilerApi> {
  const compat = await import('@typescript/typescript6')
  return compat.default ?? compat
}

/**
 * Loads the TypeScript JS compiler API from the bundled `@typescript/typescript6` compat package.
 * @internal
 */
export function getCompilerApi(): Promise<TSCompilerApi> {
  compilerApi ??= importCompilerApi()
  return compilerApi
}
