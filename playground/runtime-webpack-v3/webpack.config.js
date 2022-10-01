// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path')

module.exports = {
  entry: './main',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js',
    publicPath: '/',
    library: 'RuntimeWebpack',
    libraryTarget: 'umd',
  },
  devtool: 'source-map',
  context: __dirname,
  target: 'web',
  externals: [],
}
