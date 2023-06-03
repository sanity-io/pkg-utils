import {
  Extractor,
  ExtractorConfig,
  ExtractorMessage,
  ExtractorResult,
} from '@microsoft/api-extractor'
import fs from 'fs/promises'
import {mkdirp} from 'mkdirp'
import path from 'path'
import prettier from 'prettier'

import {BuildFile, PkgConfigOptions} from '../../core'
import {createApiExtractorConfig} from './createApiExtractorConfig'
import {createTSDocConfig} from './createTSDocConfig'
import {extractModuleBlocksFromTypes} from './extractModuleBlocks'
import {getExtractMessagesConfig} from './getExtractMessagesConfig'

export async function extractTypes(options: {
  customTags: NonNullable<PkgConfigOptions['extract']>['customTags']
  cwd: string
  distPath: string
  exportPath: string
  filePath: string
  files: BuildFile[]
  projectPath: string
  rules?: NonNullable<PkgConfigOptions['extract']>['rules']
  sourceTypesPath: string
  tmpPath: string
  tsconfigPath: string
}): Promise<{extractorResult: ExtractorResult; messages: ExtractorMessage[]}> {
  const {
    customTags,
    distPath,
    exportPath,
    files,
    filePath,
    projectPath,
    rules,
    sourceTypesPath,
    tmpPath,
    tsconfigPath,
  } = options

  const tsdocConfigFile = await createTSDocConfig({
    customTags: customTags || [],
  })

  const extractorConfig: ExtractorConfig = ExtractorConfig.prepare({
    configObject: createApiExtractorConfig({
      distPath,
      exportPath,
      filePath,
      messages: getExtractMessagesConfig({rules}),
      projectFolder: projectPath,
      mainEntryPointFilePath: sourceTypesPath,
      tsconfigPath,
    }),
    configObjectFullPath: undefined,
    tsdocConfigFile,
    packageJsonFullPath: path.resolve(projectPath, 'package.json'),
  })

  const messages: ExtractorMessage[] = []

  // Invoke API Extractor
  const extractorResult = Extractor.invoke(extractorConfig, {
    // Equivalent to the "--local" command-line parameter
    localBuild: true,
    // Equivalent to the "--verbose" command-line parameter
    showVerboseMessages: true,
    // handle messages
    messageCallback(message: ExtractorMessage) {
      messages.push(message)
      message.handled = true
    },
  })

  const typesPath = path.resolve(distPath, filePath)
  const typesBuf = await fs.readFile(typesPath)
  const prettierConfig = await prettier.resolveConfig(typesPath)

  await mkdirp(path.dirname(typesPath))

  const moduleBlocks = await extractModuleBlocksFromTypes({
    extractResult: extractorResult,
    tsOutDir: tmpPath,
  })

  const code = [typesBuf.toString(), ...moduleBlocks].join('\n\n')

  await fs.writeFile(
    typesPath,
    prettier.format(code, {
      ...prettierConfig,
      filepath: typesPath,
    })
  )

  // Add to `files` in context
  files.push({
    type: 'types',
    path: typesPath,
  })

  return {extractorResult, messages}
}
