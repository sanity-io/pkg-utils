import {build} from '@sanity/pkg-utils'

try {
  await build({
    cwd: process.cwd(),
  })
  console.log('successfully built')
} catch (err) {
  console.error(`build error: ${err.message}`)
  process.exit(1)
}
