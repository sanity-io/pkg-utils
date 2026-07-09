import type ts from '@typescript/typescript6'
import {getCompilerApi} from './compilerApi.ts'

/** @internal */
export async function loadTSConfig(options: {
  cwd: string
  tsconfigPath: string
}): Promise<ts.ParsedCommandLine | undefined> {
  const {cwd, tsconfigPath} = options
  const tsApi = await getCompilerApi()

  // oxlint-disable-next-line unbound-method
  const configPath = tsApi.findConfigFile(cwd, tsApi.sys.fileExists, tsconfigPath)

  if (!configPath) {
    return undefined
  }

  // oxlint-disable-next-line unbound-method
  const configFile = tsApi.readConfigFile(configPath, tsApi.sys.readFile)

  return tsApi.parseJsonConfigFileContent(configFile.config, tsApi.sys, cwd)
}
