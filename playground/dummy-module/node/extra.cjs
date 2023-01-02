// eslint-disable-next-line @typescript-eslint/no-var-requires
const cjs = require('../dist/extra.cjs')

module.exports = {
  ...cjs,
  path: 'node/extra.cjs',
}
