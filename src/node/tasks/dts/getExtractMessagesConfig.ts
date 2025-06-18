import type {ExtractorLogLevel, IExtractorMessagesConfig} from '@microsoft/api-extractor'
import type {PkgConfigOptions, PkgRuleLevel} from '../../core/config/types'

const LOG_LEVELS: Record<PkgRuleLevel, ExtractorLogLevel> = {
  error: 'error' as ExtractorLogLevel.Error,
  info: 'info' as ExtractorLogLevel.Info,
  off: 'none' as ExtractorLogLevel.None,
  warn: 'warning' as ExtractorLogLevel.Warning,
}

/** @alpha */
export function getExtractMessagesConfig(options: {
  rules: NonNullable<PkgConfigOptions['extract']>['rules']
}): IExtractorMessagesConfig {
  const {rules} = options

  function ruleToLogLevel(
    key: keyof NonNullable<NonNullable<PkgConfigOptions['extract']>['rules']>,
    defaultLevel?: ExtractorLogLevel,
  ) {
    const r = rules?.[key]

    return (r ? LOG_LEVELS[r] : defaultLevel || 'warning') as ExtractorLogLevel
  }

  return {
    compilerMessageReporting: {
      default: {
        logLevel: 'warning' as ExtractorLogLevel,
      },
    },

    extractorMessageReporting: {
      'default': {
        logLevel: 'warning' as ExtractorLogLevel,
        addToApiReportFile: false,
      },

      'ae-forgotten-export': {
        /**
         * This is hardcoded to `none` as it's no longer needed since TypeScript 5.5 https://github.com/microsoft/TypeScript/issues/42873
         * It's hardcoded to `none` since supported by API Extractor when using `module: 'Preserve'` doesn't support it well since `@microsoft/api-extractor` v7.49.0, which upgraded from TS 5.4 to 5.7 internally
         */
        logLevel: 'none' as ExtractorLogLevel,
        addToApiReportFile: false,
      },

      'ae-incompatible-release-tags': {
        logLevel: ruleToLogLevel('ae-incompatible-release-tags', 'error' as ExtractorLogLevel),
        addToApiReportFile: false,
      },

      'ae-internal-missing-underscore': {
        logLevel: ruleToLogLevel('ae-internal-missing-underscore'),
        addToApiReportFile: false,
      },

      'ae-missing-release-tag': {
        logLevel: ruleToLogLevel('ae-missing-release-tag', 'error' as ExtractorLogLevel),
        addToApiReportFile: false,
      },

      'ae-wrong-input-file-type': {
        logLevel: 'none' as ExtractorLogLevel,
        addToApiReportFile: false,
      },
    },

    tsdocMessageReporting: {
      'default': {
        logLevel: 'warning' as ExtractorLogLevel,
        addToApiReportFile: false,
      },

      'tsdoc-link-tag-unescaped-text': {
        logLevel: ruleToLogLevel('tsdoc-link-tag-unescaped-text', 'warning' as ExtractorLogLevel),
        addToApiReportFile: false,
      },

      'tsdoc-undefined-tag': {
        logLevel: ruleToLogLevel('tsdoc-undefined-tag', 'error' as ExtractorLogLevel),
        addToApiReportFile: false,
      },

      'tsdoc-unsupported-tag': {
        logLevel: ruleToLogLevel('tsdoc-unsupported-tag', 'none' as ExtractorLogLevel),
        addToApiReportFile: false,
      },
    },
  }
}
