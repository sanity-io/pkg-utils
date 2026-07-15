/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK).
 */
import {promisify} from 'node:util'
import zlib from 'node:zlib'

const zip = promisify(zlib.gzip)
const unzip = promisify(zlib.gunzip)

// The byte threshold for applying compression, below which compressing would out-weigh its value.
const compressionThreshold = 1000
const compressionFlag = '#'

/**
 * Serializes CSS into the base64url payload of a virtual `.vanilla.css?source=` module id,
 * gzipping when the CSS is large enough for compression to pay off.
 * @internal
 */
export async function serializeCss(source: string): Promise<string> {
  if (source.length > compressionThreshold) {
    const compressedSource = await zip(source)
    return compressionFlag + compressedSource.toString('base64url')
  }

  return Buffer.from(source, 'utf-8').toString('base64url')
}

/**
 * Reverses {@link serializeCss}.
 * @internal
 */
export async function deserializeCss(source: string): Promise<string> {
  if (source.indexOf(compressionFlag) > -1) {
    const decompressedSource = await unzip(
      Buffer.from(source.replace(compressionFlag, ''), 'base64url'),
    )
    return decompressedSource.toString('utf-8')
  }

  return Buffer.from(source, 'base64url').toString('utf-8')
}
