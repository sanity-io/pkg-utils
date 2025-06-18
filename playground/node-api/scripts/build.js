import {build} from '@sanity/pkg-utils'

build({
  cwd: process.cwd(),
})
  .then(() => {
    console.log('successfully built')
  })
  .catch((err) => {
    console.error(`build error: ${err.message}`)
    process.exit(1)
  })
