import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {getPackageInfo} from '../src/packageInfo.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('getPackageInfo', () => {
  test('resolves the nearest package.json with a name', () => {
    const info = getPackageInfo(__dirname)
    const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))

    expect(info.name).toBe('@sanity/vanilla-extract-integration')
    expect(info.version).toBe(manifest.version)
    expect(info.dirname).toBe(path.resolve(__dirname, '..'))
    expect(info.path).toBe(path.resolve(__dirname, '../package.json'))
  })

  test('walks past nameless package.json files', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'package-info-'))
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({name: 'outer-package', version: '1.2.3'}),
    )

    const nested = path.join(root, 'nameless', 'deep')
    mkdirSync(nested, {recursive: true})
    writeFileSync(
      path.join(root, 'nameless', 'package.json'),
      JSON.stringify({private: true, version: '9.9.9'}),
    )

    const info = getPackageInfo(nested)

    expect(info.name).toBe('outer-package')
    // The version comes from the same package.json as the name
    expect(info.version).toBe('1.2.3')
    expect(info.dirname).toBe(root)
  })

  test('leaves the version out when the package.json has none', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'package-info-'))
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({name: 'unversioned'}))

    expect(getPackageInfo(root)).not.toHaveProperty('version')
  })
})
