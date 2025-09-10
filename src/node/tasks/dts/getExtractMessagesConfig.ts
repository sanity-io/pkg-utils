import type {ExtractorLogLevel, IExtractorMessagesConfig} from '@microsoft/api-extractor'

import type {PkgConfigOptions, PkgRuleLevel} from '../../core'

const LOG_LEVELS: Record<PkgRuleLevel, ExtractorLogLevel> = {
  error: 'error' as ExtractorLogLevel.Error,
  info: 'info' as ExtractorLogLevel.Info,
  off: 'none' as ExtractorLogLevel.None,
  warn: 'warning' as ExtractorLogLevel.Warning,
}

/** @internal */
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
        logLevel: ruleToLogLevel('ae-forgotten-export', 'none' as ExtractorLogLevel),
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
