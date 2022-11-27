/** @internal */
export const _MODULE_EXT: Record<'commonjs' | 'module', {commonjs: string; esm: string}> = {
  // pkg.type: "commonjs"
  commonjs: {
    commonjs: '.js',
    // NOTE: using the `.mjs` extension causing issues in situations where
    // not every and all dependencies support ESM exports.
    // So for now, we require the ESM modules to have the `.esm.js` extension.
    esm: '.esm.js',
  },

  // pkg.type: "module"
  module: {
    commonjs: '.cjs',
    esm: '.js',
  },
}
