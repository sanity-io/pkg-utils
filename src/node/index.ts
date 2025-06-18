export {build} from './build'
export {check} from './check'
export {defineConfig} from './core/config/defineConfig'
export {loadConfig} from './core/config/loadConfig'
export type {
  PkgFormat,
  PkgRuntime,
  PkgExport,
  PkgConfigPropertyResolver,
  PkgConfigProperty,
  PkgBundle,
  PkgExports,
  PkgRuleLevel,
  TSDocCustomTag,
  ReactCompilerOptions,
  ReactCompilerLoggerEvent,
  ReactCompilerLogger,
  PkgConfigOptions,
} from './core/config/types'
export {DEFAULT_BROWSERSLIST_QUERY} from './core/defaults'
export {loadPkg} from './core/pkg/loadPkg'
export {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting'
export {parseExports} from './core/pkg/parseExports'
export * from './core/pkg/types'
export {defineTemplateOption} from './core/template/define'
export {
  type PkgTemplateFile,
  type PkgTemplateStringOption,
  type PkgTemplateOption,
  type PkgTemplateDefinition,
  type PkgTemplateResolver,
  type PkgTemplate,
} from './core/template/types'

export {init} from './init'
export {createLogger} from './logger'
export {
  type StrictOptions,
  type InferredStrictOptions,
  parseStrictOptions,
  strictOptions,
  toggle,
  type ToggleType,
} from './strict'
export {getExtractMessagesConfig} from './tasks/dts/getExtractMessagesConfig'
export {watch} from './watch'

export type {Plugin as RollupPlugin} from 'rollup'
