import {expect, test, vi} from 'vitest'
import {defineConfig} from '../src/index.ts'

// A consumer that enables `panda` without installing the optional peer dependency
vi.mock('@sanity/pandacss-tsdown-plugin', () => {
  throw new Error("Cannot find package '@sanity/pandacss-tsdown-plugin'")
})

test('`panda` explains how to install the missing optional peer dependency', async () => {
  await expect(defineConfig({panda: true})).rejects.toThrow(
    '`panda` needs `pnpm add -D @sanity/pandacss-tsdown-plugin`.',
  )
})
