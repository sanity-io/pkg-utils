import ts from 'typescript'

/** @internal */
export async function loadTSConfig(options: {
  cwd: string
  tsconfigPath: string
}): Promise<ts.ParsedCommandLine | undefined> {
  const {cwd, tsconfigPath} = options

  const configPath = ts.findConfigFile(cwd, (fileName) => ts.sys.fileExists(fileName), tsconfigPath)

  if (!configPath) {
    return undefined
  }

  const configFile = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path))

  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, cwd)
}
