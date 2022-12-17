/** @internal */
export const MODULE_EXT: Record<'commonjs' | 'module', {commonjs: string; esm: string}> = {
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
