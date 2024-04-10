/* eslint-disable no-console */
import path from 'node:path'

import {mkdirp} from 'mkdirp'
import rimraf from 'rimraf'

import {exec} from './exec'
import {ExecError} from './ExecError'
import {stripColor} from './stripColor'

async function runExec(cmd: string) {
  try {
    const env = {
      ...process.env,
      PATH: `${process.env.PATH}:${path.resolve(__dirname, '../../bin')}`,
    }
    const tmpPath = path.resolve(__dirname, '../..')

    return exec(cmd, {cwd: tmpPath, env})
  } catch (execErr) {
    if (execErr instanceof ExecError) {
      console.log(execErr.stdout)
      console.error(execErr.stderr)

      return {
        stdout: stripColor(execErr.stdout),
        stderr: stripColor(execErr.stderr),
      }
    }

    throw execErr
  }
}

export async function setup() {
  const workspacePath = path.resolve(__dirname, '__tmp__')

  await mkdirp(workspacePath)

  return async () => {
    await rimraf(workspacePath)
    await runExec('pnpm install --no-frozen-lockfile')
  }
}
