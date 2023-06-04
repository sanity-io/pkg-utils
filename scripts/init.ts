import path from 'path'
import {argv} from 'process'

import {init} from '../src/node'

global.__DEV__ = true

const args = argv.slice(2)

init({
  cwd: path.resolve(__dirname, '..'),
  path: args[0],
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.stack)
  process.exit(1)
})
