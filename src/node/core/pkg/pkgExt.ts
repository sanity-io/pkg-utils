/** @internal */
export interface PkgExtMap {
  commonjs: {commonjs: string; esm: string}
  module: {commonjs: string; esm: string}
}

/** @internal */
export const DEFAULT_PKG_EXT_MAP: PkgExtMap = {
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
}

/** @internal */
export function getPkgExtMap(options: {legacyExports: boolean}): PkgExtMap {
  const {legacyExports} = options

  const ret = {...DEFAULT_PKG_EXT_MAP}

  // Fall back to legacy file extensions for package.json with `"type": "commonjs"`
  // NOTE: Not supported by Node 14+ and will be removed in a future version
  if (legacyExports) {
    ret['commonjs'] = {
      commonjs: '.js',
      esm: '.esm.js',
    }
  }

  return ret
}
