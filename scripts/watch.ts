import path from 'path'
import { watch } from '../src/node'

global.__DEV__ = true

watch({
  cwd: path.resolve(__dirname, '..'),
  strict: true,
}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
