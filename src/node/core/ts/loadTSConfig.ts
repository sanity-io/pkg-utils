import ts from 'typescript'

/** @internal */
export async function loadTSConfig(options: {
  cwd: string
  tsconfigPath: string
}): Promise<ts.ParsedCommandLine | undefined> {
  const {cwd, tsconfigPath} = options

  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, tsconfigPath)

  if (!configPath) {
    return undefined
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, cwd)
}
