import fs from 'node:fs/promises'
import path from 'node:path'
import {
  Extractor,
  ExtractorConfig,
  type ExtractorMessage,
  type ExtractorResult,
} from '@microsoft/api-extractor'
import {mkdirp} from 'mkdirp'
import * as prettier from 'prettier'
import type ts from 'typescript'
import type {PkgConfigOptions} from '../../core/config/types.ts'
import type {BuildFile} from '../../core/contexts/buildContext.ts'
import {createApiExtractorConfig} from './createApiExtractorConfig.ts'
import {createTSDocConfig} from './createTSDocConfig.ts'
import {getExtractMessagesConfig} from './getExtractMessagesConfig.ts'

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
  /**
   * If the extractor is disabled then it means API Extractor is only used to bundle dts, and not check tsdoc release tags.
   */
  extractorDisabled: boolean
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
    extractorDisabled,
  } = options

  const tsdocConfigFile = await createTSDocConfig({
    customTags: customTags || [],
  })

  const filePath = filePaths[0]!.replace(/\.d\.[mc]ts$/, '.d.ts')
  // If there are package.config.ts `bundles` we might not have something that should leave behind a `.d.ts` file and need to handle that
  const shouldCleanUpDts = !filePaths.includes(filePath)
  const extractorConfig: ExtractorConfig = ExtractorConfig.prepare({
    configObject: createApiExtractorConfig({
      bundledPackages,
      distPath,
      exportPath,
      filePath,
      messages: getExtractMessagesConfig({rules, disabled: extractorDisabled}),
      projectFolder: projectPath,
      mainEntryPointFilePath: sourceTypesPath,
      tsconfig,
      tsconfigPath,
      dtsRollupEnabled: true,
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

  const {extractModuleBlocksFromTypes} = await import('./extractModuleBlocks.ts')
  const moduleBlocks = extractModuleBlocksFromTypes({
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
