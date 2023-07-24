import {Logger} from '../../logger'

/** @public */
export interface PkgTemplateFile {
  name: string
  contents: string
}

/** @public */
export interface PkgTemplateStringOption<T = string> {
  name: string
  type: 'string'
  description: string
  initial?: T | ((options: Record<string, any>) => T)
  parse?: (v: string) => T | null
  validate?: (v: string) => string | true
}

/** @public */
export type PkgTemplateOption<T = string> = PkgTemplateStringOption<T>

/** @public */
export interface PkgTemplateDefinition {
  options: PkgTemplateStringOption<any>[]
  features: {
    name: string
    optional: boolean
    initial: boolean
  }[]
  getFiles: (
    options: Record<string, any>,
    features: Record<string, boolean>,
  ) => Promise<PkgTemplateFile[]>
}

/** @public */
export type PkgTemplateResolver = (options: {
  cwd: string
  /** @internal */
  logger: Logger
  packagePath: string
}) => PkgTemplateDefinition | Promise<PkgTemplateDefinition>

/** @public */
export type PkgTemplate = PkgTemplateDefinition | PkgTemplateResolver
