// eslint-disable-next-line @typescript-eslint/no-var-requires
const cjs = require('../dist/index')

module.exports = {
  ...cjs,
  path: 'node/index.js',
}
