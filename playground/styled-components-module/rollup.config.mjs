import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'

export default {
  logLevel: 'debug',
  input: ['src/index2.js'],
  output: {
    entryFileNames: '[name].js',
    dir: 'dist',
    format: 'esm',
    exports: 'named',
    interop: 'auto',
  },
  plugins: [
    resolve({
      extensions: ['.cjs', '.mjs', '.js', '.jsx', '.json', '.node'],
      preferBuiltins: true,
      // allowExportsFolderMapping: false,
      // exportConditions: ['node'],
      // resolveOnly: (mod) => {
      //   return mod !== 'styled-components'
      // },

      // Intentionally not using 'module' as it has problems with styled-components and Node in ESM mode
      // mainFields: ['main'],
      // modulesOnly: true,
    }),
    // /*
    commonjs({
      esmExternals: true,
      // defaultIsModuleExports: true,
      // requireReturnsDefault: false,
    }),
    // */
    // cjsDetectionPlugin(),
  ],
  external: ['react', 'react/jsx-runtime'],
}
