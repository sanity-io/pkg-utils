import path from 'path'
import {fileURLToPath} from 'url'
import {build} from '../src/node/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.___DEV___ = true

build({cwd: path.resolve(__dirname, '..'), strict: true}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
