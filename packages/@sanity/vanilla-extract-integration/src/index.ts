/**
 * A vendored port of `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK)
 * onto the rolldown toolchain: the esbuild child compilation is replaced by rolldown, the babel
 * debug-ID transform by an AST pass over `rolldown/parseAst`'s oxc AST, and the `eval` package
 * by `node:vm` — see each module for details. Only the API surface consumed by the
 * `@sanity/vanilla-extract-*` plugins is exposed.
 *
 * @packageDocumentation
 */

export {compile, type CompileOptions} from './compile.ts'
export {cssFileFilter, virtualCssFileFilter} from './filters.ts'
export {getSourceFromVirtualCssFile} from './getSourceFromVirtualCssFile.ts'
export {normalizePath} from './normalizePath.ts'
export {getPackageInfo, type PackageInfo} from './packageInfo.ts'
export {processVanillaFile, type ProcessVanillaFileOptions} from './processVanillaFile.ts'
export {serializeVanillaModule} from './serializeVanillaModule.ts'
export {transform, type TransformParams} from './transform.ts'
export type {IdentifierOption} from './types.ts'
