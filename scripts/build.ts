import path from 'path'
import {build} from '../src/node'

function _run() {
  return build({
    cwd: path.resolve(__dirname, '..'),
    tsconfig: 'tsconfig.dist.json',
  })
}

_run()
