import path from 'path'
import {fileURLToPath} from 'url'
import {build} from '../src/node'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.___DEV___ = true

build({cwd: path.resolve(__dirname, '..'), strict: true}).catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : err)
  process.exit(1)
})
