// eslint-disable-next-line @typescript-eslint/no-var-requires
const cjs = require('../dist/index.cjs')

module.exports = {
  ...cjs,
  path: 'node/index.cjs',
}
