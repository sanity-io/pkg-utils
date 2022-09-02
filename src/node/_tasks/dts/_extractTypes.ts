import fs from 'fs/promises'
import path from 'path'
import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
  ExtractorMessage,
  ExtractorResult,
  IExtractorMessagesConfig,
} from '@microsoft/api-extractor'
import prettier from 'prettier'
import {PkgRuleLevel, PkgConfigOptions, _BuildFile} from '../../_core'
import {_createApiExtractorConfig} from './_createApiExtractorConfig'
import {_createTSDocConfig} from './_createTSDocConfig'

const _LOG_LEVELS: Record<PkgRuleLevel, ExtractorLogLevel> = {
  error: 'error' as ExtractorLogLevel.Error,
  info: 'info' as ExtractorLogLevel.Info,
  off: 'none' as ExtractorLogLevel.None,
  warn: 'warning' as ExtractorLogLevel.Warning,
}

export async function _extractTypes(options: {
  cwd: string
  distPath: string
  exportPath: string
  files: _BuildFile[]
  filePath: string
  projectPath: string
  rules?: NonNullable<PkgConfigOptions['extract']>['rules']
  sourcePath: string
  tsconfigPath: string
}): Promise<{extractorResult: ExtractorResult; messages: ExtractorMessage[]}> {
  const {distPath, exportPath, files, filePath, projectPath, rules, sourcePath, tsconfigPath} =
    options

  const tsdocConfigFile = await _createTSDocConfig({
    customTags: [],
  })

  function _ruleToLogLevel(
    key: keyof NonNullable<NonNullable<PkgConfigOptions['extract']>['rules']>,
    defaultLevel?: ExtractorLogLevel
  ) {
    const r = rules?.[key]

    return (r ? _LOG_LEVELS[r] : defaultLevel || 'warning') as ExtractorLogLevel
  }

  const messagesConfig: IExtractorMessagesConfig = {
    compilerMessageReporting: {
      default: {
        logLevel: 'warning' as ExtractorLogLevel,
      },
    },

    extractorMessageReporting: {
      default: {
        logLevel: 'warning' as ExtractorLogLevel,
        addToApiReportFile: false,
      },

      'ae-forgotten-export': {
        logLevel: _ruleToLogLevel('ae-forgotten-export', 'error' as ExtractorLogLevel),
        addToApiReportFile: false,
      },

      'ae-incompatible-release-tags': {
        logLevel: _ruleToLogLevel('ae-incompatible-release-tags', 'error' as ExtractorLogLevel),
        addToApiReportFile: false,
      },

      'ae-internal-missing-underscore': {
        logLevel: _ruleToLogLevel('ae-internal-missing-underscore'),
        addToApiReportFile: false,
      },

      'ae-missing-release-tag': {
        logLevel: _ruleToLogLevel('ae-missing-release-tag', 'error' as ExtractorLogLevel),
        addToApiReportFile: false,
      },

      'ae-wrong-input-file-type': {
        logLevel: 'none' as ExtractorLogLevel,
        addToApiReportFile: false,
      },
    },

    tsdocMessageReporting: {
      default: {
        logLevel: 'warning' as ExtractorLogLevel,
        addToApiReportFile: false,
      },

      // 'tsdoc-link-tag-unescaped-text': {
      //   logLevel: 'warning' as ExtractorLogLevel,
      //   addToApiReportFile: false
      // },

      // 'tsdoc-unsupported-tag': {
      //   logLevel: 'none' as ExtractorLogLevel,
      //   addToApiReportFile: false
      // },

      // 'tsdoc-undefined-tag': {
      //   logLevel: 'none' as ExtractorLogLevel,
      //   addToApiReportFile: false
      // }
    },
  }

  const extractorConfig: ExtractorConfig = ExtractorConfig.prepare({
    configObject: _createApiExtractorConfig({
      distPath,
      exportPath,
      filePath,
      messages: messagesConfig,
      projectPath,
      sourcePath,
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

  const typesPath = path.resolve(distPath, `${exportPath}.d.ts`)
  const typesBuf = await fs.readFile(typesPath)
  const prettierConfig = await prettier.resolveConfig(typesPath)

  await fs.writeFile(
    typesPath,
    prettier.format(typesBuf.toString(), {
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
