import path from 'path'
import {watch} from '../src/node'

function _run() {
  return watch({
    cwd: path.resolve(__dirname, '..'),
    tsconfig: 'tsconfig.dist.json',
  })
}

_run()
