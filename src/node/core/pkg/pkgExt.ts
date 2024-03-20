import {legacyEnding} from '../../tasks/dts/getTargetPaths'

/** @internal */
export interface PkgExtMap {
  commonjs: {commonjs: string; esm: string}
  module: {commonjs: string; esm: string}
  legacy: string
}

/** @internal */
export const pkgExtMap: PkgExtMap = {
  // pkg.type: "commonjs"
  commonjs: {
    commonjs: '.js',
    esm: '.mjs',
  },

  // pkg.type: "module"
  module: {
    commonjs: '.cjs',
    esm: '.js',
  },
  // package.config.legacyExports: true
  legacy: legacyEnding,
}
