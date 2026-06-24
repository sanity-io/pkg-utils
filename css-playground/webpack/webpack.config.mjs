import path from 'node:path'
import {fileURLToPath} from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('webpack').Configuration} */
export default {
  mode: 'production',
  entry: './src/index.tsx',
  output: {
    path: path.resolve(dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.[cm]?[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {syntax: 'typescript', tsx: true},
              transform: {react: {runtime: 'automatic'}},
            },
          },
        },
      },
      {
        // The producer's self-referential import resolves to the real CSS under the browser
        // condition, so webpack needs a CSS rule to handle it.
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
}
