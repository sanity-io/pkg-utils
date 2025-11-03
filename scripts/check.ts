import path from 'path'
import {fileURLToPath} from 'url'
import {check} from '../src/node/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.___DEV___ = true

check({
  cwd: path.resolve(__dirname, '..'),
  strict: true,
}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
