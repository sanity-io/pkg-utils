/**
 * Child-process half of `node-env-transition.test.ts`; spawned without `NODE_ENV` so the
 * `NODE_ENV`-switching CJS wrappers of `@vanilla-extract/css` are first loaded (through this
 * plugin's own imports, like a CLI host loading its config would) before `vite build` flips
 * `NODE_ENV` to `production` mid-process. Prints the build's CSS assets and entry chunk as
 * JSON for the parent test to assert on.
 */
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {vanillaExtractPlugin} from '../../src/index.ts'

if (process.env['NODE_ENV']) {
  throw new Error(`expected NODE_ENV to be unset, got ${JSON.stringify(process.env['NODE_ENV'])}`)
}

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'app')

// Imported after the plugin (and through it `@vanilla-extract/css`), mirroring a CLI host
const {build} = await import('vite')

const result = await build({
  root: appRoot,
  configFile: false,
  logLevel: 'silent',
  plugins: [vanillaExtractPlugin()],
  build: {write: false},
})

if (Array.isArray(result) || !('output' in result)) {
  throw new Error('expected a single build output')
}
let css = ''
let entry = ''
for (const assetOrChunk of result.output) {
  if (assetOrChunk.type === 'asset' && assetOrChunk.fileName.endsWith('.css')) {
    const {source} = assetOrChunk
    css += typeof source === 'string' ? source : new TextDecoder().decode(source)
  } else if (assetOrChunk.type === 'chunk' && assetOrChunk.isEntry) {
    entry = assetOrChunk.code
  }
}

process.stdout.write(JSON.stringify({css, entry}))
