import path from 'path'

import { check } from '../src/node'

global.__DEV__ = true

check({
  cwd: path.resolve(__dirname, '..'),
  strict: true,
}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
