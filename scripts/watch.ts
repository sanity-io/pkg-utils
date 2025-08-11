import path from 'path'
import {fileURLToPath} from 'url'
import {watch} from '../src/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.__DEV__ = true

watch({
  cwd: path.resolve(__dirname, '..'),
  strict: true,
}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
