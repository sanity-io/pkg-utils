import path from 'path'
import {argv} from 'process'
import {fileURLToPath} from 'url'
import {init} from '../src/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.___DEV___ = true

const args = argv.slice(2)

init({
  cwd: path.resolve(__dirname, '..'),
  path: args[0]!,
}).catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : err)
  process.exit(1)
})
