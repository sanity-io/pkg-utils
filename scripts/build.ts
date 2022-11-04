import path from 'path'
import {build} from '../src/node'

build({cwd: path.resolve(__dirname, '..'), strict: true}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.stack)
  process.exit(1)
})
