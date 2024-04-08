import fs from 'node:fs/promises'
import path from 'node:path'

import {
  Extractor,
  ExtractorConfig,
  type ExtractorMessage,
  type ExtractorResult,
} from '@microsoft/api-extractor'
import {mkdirp} from 'mkdirp'
import prettier from 'prettier'
import type ts from 'typescript'

import type {BuildFile, PkgConfigOptions} from '../../core'
import {createApiExtractorConfig} from './createApiExtractorConfig'
import {createTSDocConfig} from './createTSDocConfig'
import {extractModuleBlocksFromTypes} from './extractModuleBlocks'
import {getExtractMessagesConfig} from './getExtractMessagesConfig'

export async function extractTypes(options: {
  bundledPackages?: string[]
  customTags: NonNullable<PkgConfigOptions['extract']>['customTags']
  cwd: string
  distPath: string
  exportPath: string
  filePaths: string[]
  files: BuildFile[]
  projectPath: string
  rules?: NonNullable<PkgConfigOptions['extract']>['rules']
  sourceTypesPath: string
  tmpPath: string
  tsconfig: ts.ParsedCommandLine
  tsconfigPath: string
}): Promise<{extractorResult: ExtractorResult; messages: ExtractorMessage[]}> {
  const {
    bundledPackages,
    customTags,
    distPath,
    exportPath,
    files,
    filePaths,
    projectPath,
    rules,
    sourceTypesPath,
    tmpPath,
    tsconfig,
    tsconfigPath,
  } = options

  const tsdocConfigFile = await createTSDocConfig({
    customTags: customTags || [],
  })

  const filePath = filePaths[0].replace(/\.d\.[mc]ts$/, '.d.ts')
  // If there are package.config.ts `bundles` we might not have something that should leave behind a `.d.ts` file and need to handle that
  const shouldCleanUpDts = !filePaths.includes(filePath)
  const extractorConfig: ExtractorConfig = ExtractorConfig.prepare({
    configObject: createApiExtractorConfig({
      bundledPackages,
      distPath,
      exportPath,
      filePath,
      messages: getExtractMessagesConfig({rules}),
      projectFolder: projectPath,
      mainEntryPointFilePath: sourceTypesPath,
      tsconfig,
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
  const prettyCode = await prettier.format(code, {
    ...prettierConfig,
    filepath: typesPath,
  })

  for (const expFilePath of filePaths) {
    const expTypesPath = path.resolve(distPath, expFilePath)

    await fs.writeFile(expTypesPath, prettyCode)

    // Add to `files` in context
    files.push({
      type: 'types',
      path: expTypesPath,
    })
  }

  if (shouldCleanUpDts) {
    await fs.unlink(typesPath)
  }

  return {extractorResult, messages}
}
