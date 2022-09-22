/** @internal */
export const _MODULE_EXT: Record<'commonjs' | 'module', {commonjs: string; esm: string}> = {
  // "type": "commonjs"
  commonjs: {
    commonjs: '.js',
    esm: '.mjs',
  },
  // "type": "module"
  module: {
    commonjs: '.cjs',
    esm: '.js',
  },
}
