import type {IConfigFile, IExtractorMessagesConfig} from '@microsoft/api-extractor'
import path from 'path'
import ts from 'typescript'

export function createApiExtractorConfig(options: {
  bundledPackages?: string[]
  distPath: string
  exportPath: string
  filePath: string
  messages: IExtractorMessagesConfig
  projectFolder: string
  mainEntryPointFilePath: string
  tsconfig: ts.ParsedCommandLine
  tsconfigPath: string
}): IConfigFile {
  const {
    bundledPackages,
    distPath,
    exportPath,
    filePath,
    messages,
    projectFolder,
    mainEntryPointFilePath,
    tsconfig,
    tsconfigPath,
  } = options

  return {
    apiReport: {
      enabled: false,
      reportFileName: '<unscopedPackageName>.api.md',
    },
    bundledPackages,
    compiler:
      tsconfig.options.module === ts.ModuleKind.Preserve
        ? {
            // When the module is 'preserve' it's necessary to override the tsconfig file as api-extractor doesn't handle it out of the box
            overrideTsconfig: {
              extends: tsconfigPath,
              compilerOptions: {
                // Set the equivalent options to `module: 'Preserve'`
                // https://github.com/microsoft/TypeScript/pull/56785/files?file-filters%5B%5D=.js&file-filters%5B%5D=.json&file-filters%5B%5D=.symbols&file-filters%5B%5D=.ts&file-filters%5B%5D=.types&show-viewed-files=true#diff-31d3c12bafea26bc9e8c8a77920c41af0c593206442add70c45a06c063767445
                module: 'ESNext',
                moduleResolution: 'Bundler',
                esModuleInterop: true,
                resolveJsonModule: true,
              },
            },
          }
        : {
            // If the module is not 'preserve', use the tsconfig file directly
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
    mainEntryPointFilePath,
    projectFolder,
  }
}
