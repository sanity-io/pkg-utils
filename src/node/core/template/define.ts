import type {PkgTemplateOption} from './types.ts'

/** @public */
export function defineTemplateOption<T>(option: PkgTemplateOption<T>): PkgTemplateOption<T> {
  return option
}
