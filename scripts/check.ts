import path from 'path'

import {check} from '../src/node'

global.__DEV__ = true

check({
  cwd: path.resolve(__dirname, '..'),
  strict: true,
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.stack)
  process.exit(1)
})
