import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rspack} from '@rspack/core'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('@rspack/core').Configuration} */
export default {
  mode: 'production',
  entry: './src/index.tsx',
  output: {
    path: path.resolve(dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  plugins: [new rspack.HtmlRspackPlugin({template: './src/index.html'})],
  devServer: {
    port: 8081,
    open: false,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.[cm]?[jt]sx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {syntax: 'typescript', tsx: true},
            transform: {react: {runtime: 'automatic'}},
          },
        },
      },
    ],
  },
  // Native CSS handling resolves the producer's self-referential import to the real CSS file.
  experiments: {css: true},
}
