import path from 'path'
import {fileURLToPath} from 'url'
import {check} from '../src/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.__DEV__ = true

check({
  cwd: path.resolve(__dirname, '..'),
  strict: true,
}).catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : err)
  process.exit(1)
})
