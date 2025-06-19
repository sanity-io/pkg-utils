import {cjsEnding, defaultEnding, mjsEnding} from '../../tasks/dts/getTargetPaths'

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
