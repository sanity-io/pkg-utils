import {execFileSync} from 'node:child_process'
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import published from '@sanity/oxfmt-config'
import {describe, expect, test} from 'vitest'
import config from '../index.js'

const require = createRequire(import.meta.url)
const oxfmtDir = dirname(require.resolve('oxfmt/package.json'))
const oxfmtBin = join(oxfmtDir, 'bin/oxfmt')
const sharedJson = fileURLToPath(new URL('../oxfmt.json', import.meta.url))
const linkType = process.platform === 'win32' ? 'junction' : 'dir'

const source = 'const value = { a: 1 }\nconsole.log("hi")\n'
const formatted = "const value = {a: 1}\nconsole.log('hi')\n"

describe('@sanity/oxfmt-config', () => {
  test('default export matches the published JSON file', () => {
    expect(config).toEqual({
      semi: false,
      singleQuote: true,
      bracketSpacing: false,
    })
    expect(published).toEqual(config)
    expect(JSON.parse(readFileSync(sharedJson, 'utf8'))).toEqual(config)
  })

  test('oxfmt -c applies the JSON config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sanity-oxfmt-'))
    try {
      const file = join(dir, 'example.js')
      writeFileSync(file, source)
      execFileSync(
        process.execPath,
        [oxfmtBin, '--disable-nested-config', '-c', sharedJson, file],
        {
          cwd: dir,
        },
      )
      expect(readFileSync(file, 'utf8')).toBe(formatted)
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })

  test('oxfmt.config.ts can spread the package', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sanity-oxfmt-ts-'))
    try {
      const file = join(dir, 'example.js')
      writeFileSync(file, source)
      mkdirSync(join(dir, 'node_modules/@sanity'), {recursive: true})
      symlinkSync(
        fileURLToPath(new URL('..', import.meta.url)),
        join(dir, 'node_modules/@sanity/oxfmt-config'),
        linkType,
      )
      symlinkSync(oxfmtDir, join(dir, 'node_modules/oxfmt'), linkType)
      writeFileSync(
        join(dir, 'oxfmt.config.ts'),
        `import shared from '@sanity/oxfmt-config'\nimport {defineConfig} from 'oxfmt'\n\nexport default defineConfig({...shared})\n`,
      )
      execFileSync(process.execPath, [oxfmtBin, '--disable-nested-config', file], {cwd: dir})
      expect(readFileSync(file, 'utf8')).toBe(formatted)
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })
})
