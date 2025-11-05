import type {IConfigFile, IExtractorMessagesConfig} from '@microsoft/api-extractor'
import ts from 'typescript'

// Normalize path to use forward slashes for consistency, especially on Windows
// API Extractor can have issues with Windows-style backslash paths
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

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
  dtsRollupEnabled: boolean
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
    dtsRollupEnabled,
  } = options

  // Normalize all paths to use forward slashes to avoid Windows path issues
  const normalizedMainEntryPointFilePath = normalizePath(mainEntryPointFilePath)
  const normalizedProjectFolder = normalizePath(projectFolder)
  const normalizedTsconfigPath = normalizePath(tsconfigPath)
  const normalizedDistPath = normalizePath(distPath)
  const normalizedFilePath = normalizePath(filePath)
  const normalizedExportPath = normalizePath(exportPath)

  return {
    apiReport: {
      enabled: false,
      reportFileName: '<unscopedPackageName>.api.md',
    },
    bundledPackages,

    // If `paths` are used for self-referencing imports (e.g. the module is named `sanity`, and the `sanity/structure` export is also importing from `sanity/router`),
    compiler: tsconfig.options.paths
      ? {
          overrideTsconfig: {
            extends: normalizedTsconfigPath,
            compilerOptions: {
              // An empty object replaces whatever is in the original tsconfig file
              paths: {},
            },
          },
        }
      : {tsconfigFilePath: normalizedTsconfigPath},

    docModel: {
      enabled: false,
      apiJsonFilePath: `${normalizedDistPath}/${normalizedExportPath}.api.json`,
    },
    dtsRollup: {
      enabled: dtsRollupEnabled,
      untrimmedFilePath: `${normalizedDistPath}/${normalizedFilePath}`,
      // betaTrimmedFilePath: path.resolve(distPath, filePath.replace('.d.ts', '-beta.d.ts')),
      // publicTrimmedFilePath: path.resolve(distPath, filePath.replace('.d.ts', '-public.d.ts')),
    },
    tsdocMetadata: {
      enabled: false,
    },
    messages,
    mainEntryPointFilePath: normalizedMainEntryPointFilePath,
    projectFolder: normalizedProjectFolder,
  }
}
