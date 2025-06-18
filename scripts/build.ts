import path from 'path'
import { build } from '../src/node'

global.__DEV__ = true

build({cwd: path.resolve(__dirname, '..'), strict: true}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
