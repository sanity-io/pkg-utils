import type {PkgTemplateOption} from './types'

/** @public */
export function defineTemplateOption<T>(option: PkgTemplateOption<T>): PkgTemplateOption<T> {
  return option
}
