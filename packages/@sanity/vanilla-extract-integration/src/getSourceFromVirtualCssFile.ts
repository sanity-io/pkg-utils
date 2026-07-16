/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK).
 */
import {deserializeCss} from './serializeCss.ts'

/**
 * Extracts the file name and CSS from a virtual `.vanilla.css?source=` module id emitted by
 * {@link processVanillaFile}.
 * @public
 */
export async function getSourceFromVirtualCssFile(
  id: string,
): Promise<{fileName: string; source: string}> {
  const match = id.match(/^(?<fileName>.*)\?source=(?<source>.*)$/)

  if (!match || !match.groups) {
    throw new Error('No source in vanilla CSS file')
  }

  const source = await deserializeCss(match.groups['source'] ?? '')

  return {
    fileName: match.groups['fileName'] ?? '',
    source,
  }
}
