import path from 'path'
import {fileURLToPath} from 'url'
import {check} from '../src/node/check.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

check({
  cwd: path.resolve(__dirname, '..'),
  strict: true,
}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
