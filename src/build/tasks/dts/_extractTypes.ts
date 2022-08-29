import path from 'path'
import {
  Extractor,
  ExtractorConfig,
  ExtractorMessage,
  ExtractorResult,
} from '@microsoft/api-extractor'
import chalk from 'chalk'
import {_BuildFile} from '../../_types'
import {_createApiExtractorConfig} from './_createApiExtractorConfig'
import {_createTSDocConfig} from './_createTSDocConfig'

export async function _extractTypes(options: {
  cwd: string
  distPath: string
  exportPath: string
  files: _BuildFile[]
  projectPath: string
  quiet?: boolean
  sourcePath: string
  tsconfigPath: string
}): Promise<{extractorResult: ExtractorResult; messages: ExtractorMessage[]}> {
  const {cwd, distPath, exportPath, files, projectPath, quiet, sourcePath, tsconfigPath} = options

  const tsdocConfigFile = await _createTSDocConfig({
    customTags: [],
  })

  const extractorConfig: ExtractorConfig = ExtractorConfig.prepare({
    configObject: _createApiExtractorConfig({
      exportPath,
      projectPath,
      sourcePath,
      distPath,
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

  if (!quiet) {
    const warnings: ExtractorMessage[] = messages.filter((msg) => msg.logLevel === 'warning')

    for (const msg of warnings) {
      const sourceFilePath = msg.sourceFilePath && path.relative(cwd, msg.sourceFilePath)

      // eslint-disable-next-line no-console
      console.log(
        [
          `${chalk.cyan(sourceFilePath || '?')}`,
          `:${chalk.yellow(msg.sourceFileLine)}:${chalk.yellow(msg.sourceFileColumn)}`,
          ` - ${chalk.yellow('warning')} ${chalk.gray(msg.messageId)}\n`,
          msg.text,
          '\n',
        ].join('')
      )
    }
  }

  const errors: ExtractorMessage[] = messages.filter((msg) => msg.logLevel === 'error')

  for (const msg of errors) {
    const sourceFilePath = msg.sourceFilePath && path.relative(cwd, msg.sourceFilePath)

    // eslint-disable-next-line no-console
    console.log(
      [
        `${chalk.cyan(sourceFilePath || '?')}`,
        `:${chalk.yellow(msg.sourceFileLine)}:${chalk.yellow(msg.sourceFileColumn)}`,
        ` - ${chalk.red('error')} ${chalk.gray(msg.messageId)}\n`,
        msg.text,
        '\n',
      ].join('')
    )
  }

  // Add to `files` in context
  files.push({
    type: 'types',
    path: path.resolve(distPath, `${exportPath}.d.ts`),
  })

  return {extractorResult, messages}
}
