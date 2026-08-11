import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {TSDocConfigFile} from '@microsoft/tsdoc-config'
import {parse} from 'jsonc-parser'
import type {PackageTsdocCustomTag} from './types.ts'

const require = createRequire(import.meta.url)

/** @internal */
export async function createTSDocConfig(opts: {
  customTags: PackageTsdocCustomTag[]
}): Promise<TSDocConfigFile | undefined> {
  const {customTags} = opts

  if (customTags.length === 0) {
    return undefined
  }

  const tsDocBaseBuf = await readFile(
    require.resolve('@microsoft/api-extractor/extends/tsdoc-base.json'),
  )

  // Include the definitions that are required for API Extractor
  // extends: ['@microsoft/api-extractor/extends/tsdoc-base.json'],
  const tsDocBaseConfig = parse(tsDocBaseBuf.toString())

  // Define custom tags and specify how they should be parsed
  const tagDefinitions = (tsDocBaseConfig.tagDefinitions || []).concat(
    customTags.map((t) => ({
      tagName: `@${t.name}`,
      syntaxKind: t.syntaxKind,
      allowMultiple: t.allowMultiple,
    })),
  )

  // Indicate that custom tags are supported by your tooling.
  // (Without this, warnings may be reported saying that a tag is unsupported.)
  const supportForTags = {...tsDocBaseConfig.supportForTags}

  for (const customTag of customTags) {
    supportForTags[`@${customTag.name}`] = true
  }

  return TSDocConfigFile.loadFromObject({
    ...tsDocBaseConfig,
    noStandardTags: false,
    tagDefinitions,
    supportForTags,
  })
}
