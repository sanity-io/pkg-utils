import ts from 'typescript'

/** @internal */
export async function loadTSConfig(options: {
  cwd: string
  tsconfigPath: string
}): Promise<ts.ParsedCommandLine> {
  const {cwd, tsconfigPath} = options

  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, tsconfigPath)

  if (!configPath) {
    throw new Error(`could not find a valid '${tsconfigPath}'`)
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, cwd)
}
