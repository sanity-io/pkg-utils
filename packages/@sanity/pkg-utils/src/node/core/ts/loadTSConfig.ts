// The JS compiler API is loaded from the official `@typescript/typescript6` compat package
// instead of the `typescript` peer dependency, as TypeScript 7 (the Go-native compiler) no longer
// ships it
import ts from '@typescript/typescript6'

/** @internal */
export async function loadTSConfig(options: {
  cwd: string
  tsconfigPath: string
}): Promise<ReturnType<typeof ts.parseJsonConfigFileContent> | undefined> {
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
