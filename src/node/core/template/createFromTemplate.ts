import {writeFile} from 'node:fs/promises'
import {dirname, relative, resolve} from 'node:path'

import {mkdirp} from 'mkdirp'
import prompts from 'prompts'

import type {Logger} from '../../logger'
import type {PkgTemplate} from './types'

const promptsTypes = {
  string: 'text' as const,
}

/** @internal */
export async function createFromTemplate(options: {
  cwd: string
  logger: Logger
  packagePath: string
  template: PkgTemplate
}): Promise<void> {
  const {cwd, logger, packagePath, template: templateOrResolver} = options

  const template =
    typeof templateOrResolver === 'function'
      ? await templateOrResolver({cwd, logger, packagePath})
      : templateOrResolver

  logger.log('create new package at', relative(cwd, packagePath))

  const templateOptions: Record<string, string> = {}

  for (const templateOption of template.options) {
    const templateValidate = templateOption.validate

    const res = await prompts(
      {
        type: promptsTypes[templateOption.type],
        name: templateOption.name,
        message: templateOption.description,
        validate: templateValidate ? (prev) => templateValidate(prev) : undefined,
        initial:
          typeof templateOption.initial === 'function'
            ? templateOption.initial(templateOptions)
            : templateOption.initial,
      },
      {onCancel: () => process.exit(0)},
    )

    templateOptions[templateOption.name] = templateOption.parse
      ? templateOption.parse(res[templateOption.name])
      : res[templateOption.name]
  }

  const features: Record<string, boolean> = {}

  for (const templateFeature of template.features) {
    const res = templateFeature.optional
      ? await prompts(
          {
            type: 'confirm',
            name: 'confirm',
            message: `use ${templateFeature.name}?`,
            initial: templateFeature.initial,
          },
          {onCancel: () => process.exit(0)},
        )
      : undefined

    features[templateFeature.name] = res?.confirm || !templateFeature.optional
  }

  const files = await template.getFiles(templateOptions, features)

  files.sort((a, b) => {
    return a.name.localeCompare(b.name)
  })

  for (const file of files) {
    const filePath = resolve(packagePath, file.name)

    await mkdirp(dirname(filePath))
    await writeFile(filePath, file.contents.trim() + '\n')

    logger.success(`wrote ${relative(cwd, filePath)}`)
  }
}
