import path from 'path'
import {ExtractorLogLevel, IConfigFile, IExtractorMessagesConfig} from '@microsoft/api-extractor'

export const DEFAULT_MESSAGES_CONFIG: IExtractorMessagesConfig = {
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

    // 'ae-extra-release-tag': {
    //   logLevel: 'error' as ExtractorLogLevel,
    //   addToApiReportFile: false
    // },

    // 'ae-forgotten-export': {
    //   logLevel: 'error' as ExtractorLogLevel,
    //   addToApiReportFile: false
    // }
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

export function _createApiExtractorConfig(options: {
  distPath: string
  exportPath: string
  filePath: string
  projectPath: string
  sourcePath: string
  tsconfigPath: string
}): IConfigFile {
  const {distPath, exportPath, filePath, projectPath, sourcePath, tsconfigPath} = options

  return {
    apiReport: {
      enabled: false,
      reportFileName: '<unscopedPackageName>.api.md',
      // reportFileName: path.resolve(distPath, `${exportPath}.api.md`)
    },
    // bundledPackages: [],
    compiler: {
      tsconfigFilePath: tsconfigPath,
    },
    docModel: {
      enabled: false,
      // apiJsonFilePath: '<unscopedPackageName>.api.json'
      apiJsonFilePath: path.resolve(distPath, `${exportPath}.api.json`),
    },
    dtsRollup: {
      enabled: true,
      untrimmedFilePath: path.resolve(distPath, filePath),
      // untrimmedFilePath: path.resolve(distPath, `${exportPath}.d.ts`),
      // betaTrimmedFilePath: path.resolve(distPath, `${exportPath}-beta.d.ts`),
      // publicTrimmedFilePath: path.resolve(distPath, `${exportPath}-public.d.ts`)
    },
    tsdocMetadata: {
      enabled: false,
    },
    messages: DEFAULT_MESSAGES_CONFIG,
    mainEntryPointFilePath: sourcePath,
    projectFolder: projectPath,
  }
}
