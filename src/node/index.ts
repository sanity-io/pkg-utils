export {build} from './build'
export {check} from './check'
export {defineConfig} from './core/config/defineConfig'
export {loadConfig} from './core/config/loadConfig'
export {resolveConfigProperty} from './core/config/resolveConfigProperty'
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
export type {BuildFile, BuildContext} from './core/contexts/buildContext'
export {DEFAULT_BROWSERSLIST_QUERY} from './core/defaults'
export * from './core/isRecord'
export {loadPkg} from './core/pkg/loadPkg'
export {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting'
export {parseExports} from './core/pkg/parseExports'
export {type PkgExtMap, pkgExtMap} from './core/pkg/pkgExt'
export * from './core/pkg/types'
export {createFromTemplate} from './core/template/createFromTemplate'
export {defineTemplateOption} from './core/template/define'
export {
  type PkgTemplateFile,
  type PkgTemplateStringOption,
  type PkgTemplateOption,
  type PkgTemplateDefinition,
  type PkgTemplateResolver,
  type PkgTemplate,
} from './core/template/types'
export {loadTSConfig} from './core/ts/loadTSConfig'

export {init} from './init'
export {type Logger, createLogger} from './logger'
export {resolveBuildTasks} from './resolveBuildTasks'
export {
  type StrictOptions,
  type InferredStrictOptions,
  parseStrictOptions,
  strictOptions,
  toggle,
  type ToggleType,
} from './strict'
export {buildTaskHandlers, watchTaskHandlers} from './tasks'
export {dtsTask} from './tasks/dts/dtsTask'
export {dtsWatchTask} from './tasks/dts/dtsWatchTask'
export {getExtractMessagesConfig} from './tasks/dts/getExtractMessagesConfig'
export type {DtsWatchTask, DtsTask, DtsResult} from './tasks/dts/types'
export {rollupTask} from './tasks/rollup/rollupTask'
export {rollupWatchTask} from './tasks/rollup/rollupWatchTask'
export type {
  RollupTaskEntry,
  RollupTask,
  RollupWatchTask,
  BuildTask,
  WatchTask,
  TaskHandler,
  BuildTaskHandlers,
  WatchTaskHandlers,
} from './tasks/types'
export {watch} from './watch'

export type {Plugin as RollupPlugin} from 'rollup'
