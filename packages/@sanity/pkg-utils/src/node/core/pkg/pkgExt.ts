/** Matches the JS output file endings pkg-utils emits (`.js`, `.mjs`, `.cjs`). @internal */
export const fileEnding: RegExp = /\.[mc]?js$/
/** @internal */
export const defaultEnding = '.js'
/** @internal */
export const mjsEnding = '.mjs'
/** @internal */
export const cjsEnding = '.cjs'

/** @internal */
export interface PkgExtMap {
  commonjs: {commonjs: string; esm: string}
  module: {commonjs: string; esm: string}
}

/** @internal */
export const pkgExtMap: PkgExtMap = {
  // pkg.type: "commonjs"
  commonjs: {
    commonjs: defaultEnding,
    esm: mjsEnding,
  },

  // pkg.type: "module"
  module: {
    commonjs: cjsEnding,
    esm: defaultEnding,
  },
}

/** `./dist/index.js` -> `./dist/index.d.ts` (`.mjs` -> `.d.mts`, `.cjs` -> `.d.cts`). @internal */
export function toDtsFile(file: string): string {
  return file.replace(fileEnding, (extension) =>
    extension === '.mjs' ? '.d.mts' : extension === '.cjs' ? '.d.cts' : '.d.ts',
  )
}
