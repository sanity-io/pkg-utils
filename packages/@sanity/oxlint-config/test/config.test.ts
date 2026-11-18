import {execFileSync} from 'node:child_process'
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import published from '@sanity/oxlint-config'
import {describe, expect, test} from 'vitest'
import config from '../index.js'

const require = createRequire(import.meta.url)
const oxlintDir = dirname(require.resolve('oxlint/package.json'))
const oxlintBin = join(oxlintDir, 'bin/oxlint')
const sharedJson = fileURLToPath(new URL('../oxlintrc.json', import.meta.url))
const linkType = process.platform === 'win32' ? 'junction' : 'dir'

function isExecFailure(
  error: unknown,
): error is {status: number | null; stdout: string; stderr: string} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'stdout' in error &&
    'stderr' in error
  )
}

function lint(dir: string, args: string[]): {status: number; output: string} {
  try {
    const output = execFileSync(process.execPath, [oxlintBin, '--disable-nested-config', ...args], {
      cwd: dir,
      encoding: 'utf8',
    })
    return {status: 0, output}
  } catch (error) {
    if (!isExecFailure(error)) throw error
    return {status: error.status ?? 1, output: `${error.stdout}${error.stderr}`}
  }
}

describe('@sanity/oxlint-config', () => {
  test('default export matches the published JSON file', () => {
    expect(config).toEqual({categories: {correctness: 'error'}})
    expect(published).toEqual(config)
    expect(JSON.parse(readFileSync(sharedJson, 'utf8'))).toEqual(config)
  })

  test('extends raises correctness findings from warnings to errors', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sanity-oxlint-'))
    try {
      writeFileSync(join(dir, 'example.js'), 'debugger\n')
      writeFileSync(join(dir, '.oxlintrc.json'), JSON.stringify({extends: [sharedJson]}))

      const withPreset = lint(dir, ['--format', 'unix', 'example.js'])
      expect(withPreset.status).toBe(1)
      expect(withPreset.output).toContain('no-debugger')
      expect(withPreset.output).toMatch(/Error/)

      rmSync(join(dir, '.oxlintrc.json'))
      const defaults = lint(dir, ['--format', 'unix', 'example.js'])
      expect(defaults.status).toBe(0)
      expect(defaults.output).toMatch(/Warning/)
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })

  test('oxlint.config.ts can extend the package', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sanity-oxlint-ts-'))
    try {
      writeFileSync(join(dir, 'example.js'), 'debugger\n')
      mkdirSync(join(dir, 'node_modules/@sanity'), {recursive: true})
      symlinkSync(
        fileURLToPath(new URL('..', import.meta.url)),
        join(dir, 'node_modules/@sanity/oxlint-config'),
        linkType,
      )
      symlinkSync(oxlintDir, join(dir, 'node_modules/oxlint'), linkType)
      writeFileSync(
        join(dir, 'oxlint.config.ts'),
        `import shared from '@sanity/oxlint-config'\nimport {defineConfig} from 'oxlint'\n\nexport default defineConfig({extends: [shared]})\n`,
      )

      const result = lint(dir, ['--format', 'unix', 'example.js'])
      expect(result.status).toBe(1)
      expect(result.output).toContain('no-debugger')
      expect(result.output).toMatch(/Error/)
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })
})
