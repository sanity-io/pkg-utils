import path from 'path'
import {argv} from 'process'
import {fileURLToPath} from 'url'
import {init} from '../src/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.__DEV__ = true

const args = argv.slice(2)

init({
  cwd: path.resolve(__dirname, '..'),
  path: args[0]!,
}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
