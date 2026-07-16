import {describe, expect, test} from 'vitest'
import {deserializeCss, serializeCss} from '../src/serializeCss.ts'

describe('serializeCss', () => {
  test('round-trips small payloads without compression', async () => {
    const css = '.box { color: rgb(1, 2, 3); }'
    const serialized = await serializeCss(css)

    expect(serialized.startsWith('#')).toBe(false)
    await expect(deserializeCss(serialized)).resolves.toBe(css)
  })

  test('round-trips large payloads with gzip compression', async () => {
    const css = Array.from({length: 200}, (_, i) => `.box-${i} { color: rgb(1, 2, 3); }`).join('\n')
    expect(css.length).toBeGreaterThan(1000)

    const serialized = await serializeCss(css)

    expect(serialized.startsWith('#')).toBe(true)
    await expect(deserializeCss(serialized)).resolves.toBe(css)
  })
})
