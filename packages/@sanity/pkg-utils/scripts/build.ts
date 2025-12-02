import path from 'path'
import {fileURLToPath} from 'url'
import {build} from '../src/node/build.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

build({cwd: path.resolve(__dirname, '..'), strict: true}).catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
