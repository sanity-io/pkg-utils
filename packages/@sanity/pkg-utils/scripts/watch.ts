import path from 'path'
import {fileURLToPath} from 'url'
import {watch} from '../src/node/watch.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

watch({
  cwd: path.resolve(__dirname, '..'),
  strict: true,
}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
