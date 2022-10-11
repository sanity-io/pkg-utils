import path from 'path'
import {watch} from '../src/node'

watch({
  cwd: path.resolve(__dirname, '..'),
  tsconfig: 'tsconfig.dist.json',
}).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.stack)
  process.exit(1)
})
