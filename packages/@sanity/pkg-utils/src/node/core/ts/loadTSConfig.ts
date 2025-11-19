import ts from 'typescript'

/** @internal */
export async function loadTSConfig(options: {
  cwd: string
  tsconfigPath: string
}): Promise<ts.ParsedCommandLine | undefined> {
  const {cwd, tsconfigPath} = options

  // oxlint-disable-next-line unbound-method
  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, tsconfigPath)

  if (!configPath) {
    return undefined
  }

  // oxlint-disable-next-line unbound-method
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, cwd)
}
