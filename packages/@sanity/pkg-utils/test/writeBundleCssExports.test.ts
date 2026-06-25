import {mkdtemp, readFile, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {describe, expect, test} from 'vitest'
import {writeBundleCssExports} from '../src/node/core/pkg/writeBundleCssExports'
import {createLogger} from '../src/node/logger'

const logger = createLogger(true)

async function setupPackage(pkg: Record<string, unknown>): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), 'pkg-utils-ve-'))
  await writeFile(path.join(cwd, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
  return cwd
}

async function readPkg(cwd: string): Promise<{exports: Record<string, unknown>}> {
  return JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'))
}

describe('writeBundleCssExports', () => {
  test('adds the conditional css export (before ./package.json) when missing', async () => {
    const cwd = await setupPackage({
      name: 'example',
      version: '1.0.0',
      exports: {
        '.': {source: './src/index.ts', default: './dist/index.js'},
        './package.json': './package.json',
      },
    })

    await writeBundleCssExports({cwd, distPath: path.join(cwd, 'dist'), cssName: 'bundle.css', logger})

    const pkg = await readPkg(cwd)
    expect(pkg.exports['./bundle.css']).toEqual({
      browser: './dist/bundle.css',
      style: './dist/bundle.css',
      node: './dist/bundle.css.js',
      default: './dist/bundle.css.js',
    })
    expect(Object.keys(pkg.exports)).toEqual(['.', './bundle.css', './package.json'])
  })

  test('is idempotent when the export already matches', async () => {
    const cwd = await setupPackage({
      name: 'example',
      version: '1.0.0',
      exports: {
        '.': {source: './src/index.ts', default: './dist/index.js'},
        './bundle.css': {
          browser: './dist/bundle.css',
          style: './dist/bundle.css',
          node: './dist/bundle.css.js',
          default: './dist/bundle.css.js',
        },
        './package.json': './package.json',
      },
    })
    const before = await readFile(path.join(cwd, 'package.json'), 'utf8')

    await writeBundleCssExports({cwd, distPath: path.join(cwd, 'dist'), cssName: 'bundle.css', logger})

    expect(await readFile(path.join(cwd, 'package.json'), 'utf8')).toEqual(before)
  })

  test('respects a custom css name and dist directory', async () => {
    const cwd = await setupPackage({
      name: 'example',
      version: '1.0.0',
      exports: {'.': {source: './src/index.ts', default: './lib/index.js'}},
    })

    await writeBundleCssExports({cwd, distPath: path.join(cwd, 'lib'), cssName: 'styles.css', logger})

    const pkg = await readPkg(cwd)
    expect(pkg.exports['./styles.css']).toEqual({
      browser: './lib/styles.css',
      style: './lib/styles.css',
      node: './lib/styles.css.js',
      default: './lib/styles.css.js',
    })
  })
})
