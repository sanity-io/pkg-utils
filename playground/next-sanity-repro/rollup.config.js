import {nodeResolve} from '@rollup/plugin-node-resolve'


/** @type {import('rollup').RollupOptions} */
const config = {
  input: {
    index: 'src/index.ts',
    hooks: 'src/hooks/index.ts',
  },
  plugins: [nodeResolve(),],
  external: (id) => {
    const idParts = id.split('/')
    const name = idParts[0].startsWith('@') ? `${idParts[0]}/${idParts[1]}` : idParts[0]
    if (
      name &&
      ['@sanity/client', '@sanity/next-loader', '@sanity/visual-editing'].includes(name)
    ) {
      return true
    }

    return false
  },
  treeshake: {
    preset: 'recommended',
    // This line is what is causing the unexpected hoisted imports in dist/index.js
    moduleSideEffects: 'no-external',
    // It also happens with `false`
    // moduleSideEffects: false,
    // While setting it to its default value, `true`, the hoisting no longer happens
    moduleSideEffects: true,
  },
  output: {
    dir: 'dist',
    format: 'esm',
  },
}

export default config
