import path from 'path'
import {check} from '../src/node'

function _run() {
  return check({
    cwd: path.resolve(__dirname, '..'),
  })
}

_run()
