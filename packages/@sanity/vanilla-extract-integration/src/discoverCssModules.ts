import type {Dirent} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import {cssFileFilter} from './filters.ts'
import {normalizePath} from './normalizePath.ts'

/** Directories never scanned for `.css.ts` modules. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git'])

/**
 * Every `.css.ts` (and sibling extension, see {@link cssFileFilter}) module under `roots`, as
 * sorted normalized absolute paths. `node_modules`, `dist` and `.git` directories are skipped,
 * and roots that don't exist contribute nothing. This is the discovery step of whole-program
 * compilation (see {@link processVanillaProgram}).
 * @public
 */
export async function discoverCssModules(roots: ReadonlyArray<string>): Promise<string[]> {
  const found = new Set<string>()

  async function walk(directory: string): Promise<void> {
    let entries: Array<Dirent>
    try {
      entries = await fs.readdir(directory, {withFileTypes: true})
    } catch {
      return
    }
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.isDirectory()) {
          if (!SKIPPED_DIRECTORIES.has(entry.name)) await walk(path.join(directory, entry.name))
        } else if (entry.isFile() && cssFileFilter.test(entry.name)) {
          found.add(normalizePath(path.join(directory, entry.name)))
        }
      }),
    )
  }

  await Promise.all(roots.map((root) => walk(path.resolve(root))))
  return Array.from(found).toSorted((a, b) => a.localeCompare(b))
}
