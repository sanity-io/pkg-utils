import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {getPackageInfo} from '../src/packageInfo.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('getPackageInfo', () => {
  test('resolves the nearest package.json with a name', () => {
    const info = getPackageInfo(__dirname)

    expect(info.name).toBe('@sanity/vanilla-extract-integration')
    expect(info.dirname).toBe(path.resolve(__dirname, '..'))
    expect(info.path).toBe(path.resolve(__dirname, '../package.json'))
  })

  test('walks past nameless package.json files', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'package-info-'))
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({name: 'outer-package'}))

    const nested = path.join(root, 'nameless', 'deep')
    mkdirSync(nested, {recursive: true})
    writeFileSync(path.join(root, 'nameless', 'package.json'), JSON.stringify({private: true}))

    const info = getPackageInfo(nested)

    expect(info.name).toBe('outer-package')
    expect(info.dirname).toBe(root)
  })
})
