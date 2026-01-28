import fs from 'node:fs/promises'
import path from 'node:path'
import {stripVTControlCharacters} from 'node:util'
import exec from 'nanoexec'

export interface SpawnedProject {
  cwd: string
  readFile: (filePath: string) => Promise<string>
  run: (cmd: string) => Promise<string>
}

/**
 * Spawn a project from the playground directory.
 * Dependencies are pre-installed, so this just provides helpers to run commands and read files.
 */
export async function spawnProject(name: string): Promise<SpawnedProject> {
  const cwd = path.resolve(__dirname, '../../../../../playground', name)
  const binPath = path.resolve(__dirname, '../../bin')

  const env = {
    ...process.env,
    PATH: `${process.env['PATH']}${path.delimiter}${binPath}`,
  }

  return {
    cwd,

    readFile: (filePath: string) => fs.readFile(path.resolve(cwd, filePath), 'utf-8'),

    run: async (cmd: string): Promise<string> => {
      const result = await exec('pnpm', ['run', cmd], {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const stdout = result.stdout?.toString('utf-8') || ''
      const stderr = result.stderr?.toString('utf-8') || ''

      if (!result.ok) {
        const cleanStdout = stripVTControlCharacters(stdout)
        const cleanStderr = stripVTControlCharacters(stderr)
        console.log(cleanStdout)
        console.error(cleanStderr)
        throw new Error(`Command "pnpm run ${cmd}" failed with exit code ${result.code}`)
      }

      return stripVTControlCharacters(stdout)
    },
  }
}
