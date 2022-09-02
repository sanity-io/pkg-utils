import path from 'path'
import {IConfigFile, IExtractorMessagesConfig} from '@microsoft/api-extractor'

export function _createApiExtractorConfig(options: {
  distPath: string
  exportPath: string
  filePath: string
  messages: IExtractorMessagesConfig
  projectPath: string
  sourcePath: string
  tsconfigPath: string
}): IConfigFile {
  const {distPath, exportPath, filePath, messages, projectPath, sourcePath, tsconfigPath} = options

  return {
    apiReport: {
      enabled: false,
      reportFileName: '<unscopedPackageName>.api.md',
    },
    // bundledPackages: [],
    compiler: {
      tsconfigFilePath: tsconfigPath,
    },
    docModel: {
      enabled: false,
      apiJsonFilePath: path.resolve(distPath, `${exportPath}.api.json`),
    },
    dtsRollup: {
      enabled: true,
      untrimmedFilePath: path.resolve(distPath, filePath),
      // betaTrimmedFilePath: path.resolve(distPath, filePath.replace('.d.ts', '-beta.d.ts')),
      // publicTrimmedFilePath: path.resolve(distPath, filePath.replace('.d.ts', '-public.d.ts')),
    },
    tsdocMetadata: {
      enabled: false,
    },
    messages,
    mainEntryPointFilePath: sourcePath,
    projectFolder: projectPath,
  }
}
