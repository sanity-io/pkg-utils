import {mkdir, rm} from 'node:fs/promises'
import path from 'node:path'
import {rolldown} from 'rolldown'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const outputRoot = path.resolve(import.meta.dirname, '../.generated/plugins')

const plugins = [
  {
    input: path.join(
      repositoryRoot,
      'packages/@sanity/vanilla-extract-rolldown-plugin/src/index.ts',
    ),
    output: 'rolldown-plugin.mjs',
  },
  {
    input: path.join(repositoryRoot, 'packages/@sanity/vanilla-extract-vite-plugin/src/index.ts'),
    output: 'vite-plugin.mjs',
  },
] as const

function isBareImport(id: string): boolean {
  return !id.startsWith('.') && !path.isAbsolute(id)
}

await rm(outputRoot, {recursive: true, force: true})
await mkdir(outputRoot, {recursive: true})

for (const plugin of plugins) {
  const bundle = await rolldown({
    input: plugin.input,
    external: isBareImport,
    logLevel: 'silent',
  })
  try {
    await bundle.write({
      dir: outputRoot,
      entryFileNames: plugin.output,
      format: 'esm',
      sourcemap: false,
    })
  } finally {
    await bundle.close()
  }
}

// eslint-disable-next-line no-console
console.log(`Built ${plugins.length} local benchmark plugin bundles`)
