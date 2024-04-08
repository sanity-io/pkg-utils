import type {Logger} from '../../logger'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial?: T | ((options: Record<string, any>) => T)
  parse?: (v: string) => T | null
  validate?: (v: string) => string | true
}

/** @public */
export type PkgTemplateOption<T = string> = PkgTemplateStringOption<T>

/** @public */
export interface PkgTemplateDefinition {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: PkgTemplateStringOption<any>[]
  features: {
    name: string
    optional: boolean
    initial: boolean
  }[]
  getFiles: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
