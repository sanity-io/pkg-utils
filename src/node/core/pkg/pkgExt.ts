import {cjsEnding, defaultEnding, legacyEnding, mjsEnding} from '../../tasks/dts/getTargetPaths'

/** @internal */
export interface PkgExtMap {
  commonjs: {commonjs: string; esm: string}
  module: {commonjs: string; esm: string}
  legacy: string
}

/** @internal */
export const pkgExtMap = {
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
  // package.config.legacyExports: true
  legacy: legacyEnding,
} satisfies PkgExtMap
