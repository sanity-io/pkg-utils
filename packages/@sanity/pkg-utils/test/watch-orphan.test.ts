import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {watch} from '../src/node/watch'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const mtime = (file: string) => fs.statSync(file, {throwIfNoEntry: false})?.mtimeMs ?? -1

async function touch(file: string) {
  const src = await fsp.readFile(file, 'utf8')
  await fsp.writeFile(file, src.endsWith('\n') ? src.slice(0, -1) : `${src}\n`)
}

async function waitForWrite(file: string, since: number) {
  await vi.waitFor(() => expect(mtime(file)).not.toBe(since), {timeout: 10_000, interval: 25})
  return mtime(file)
}

describe.skipIf(process.platform === 'win32')('watch orphaned tsdown handles', () => {
  let cwd: string | undefined
  let abort: AbortController | undefined

  afterEach(async () => {
    abort?.abort()
    abort = undefined
    await sleep(300)
    if (cwd) await fsp.rm(cwd, {recursive: true, force: true})
    cwd = undefined
  })

  test('abort after a package.json reload stops every tsdown watcher', async () => {
    cwd = await fsp.mkdtemp(path.join(os.tmpdir(), 'pkg-watch-'))
    const fixture = path.resolve(__dirname, '../../../../playground/multi-exports-commonjs')
    for (const entry of ['package.json', 'tsconfig.json', 'src']) {
      await fsp.cp(path.join(fixture, entry), path.join(cwd, entry), {recursive: true})
    }
    await fsp.symlink(
      path.resolve(__dirname, '../../../../node_modules'),
      path.join(cwd, 'node_modules'),
    )

    const distIndex = path.join(cwd, 'dist/index.js')
    const srcIndex = path.join(cwd, 'src/index.ts')

    abort = new AbortController()
    await watch({cwd, strict: false, signal: abort.signal})
    let seen = await waitForWrite(distIndex, -1)

    await touch(srcIndex)
    seen = await waitForWrite(distIndex, seen)

    await touch(path.join(cwd, 'package.json'))
    seen = await waitForWrite(distIndex, seen)
    await sleep(1000)
    seen = mtime(distIndex)

    abort.abort()
    await sleep(500)

    await touch(srcIndex)
    await sleep(2000)
    expect(mtime(distIndex)).toBe(seen)
  })
})
