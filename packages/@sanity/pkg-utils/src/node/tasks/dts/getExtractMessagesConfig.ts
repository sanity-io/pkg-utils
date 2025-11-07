import {ExtractorLogLevel, type IExtractorMessagesConfig} from '@microsoft/api-extractor'
import type {PkgConfigOptions, PkgRuleLevel} from '../../core/config/types.ts'

const LOG_LEVELS: Record<PkgRuleLevel, ExtractorLogLevel> = {
  error: ExtractorLogLevel.Error,
  info: ExtractorLogLevel.Info,
  off: ExtractorLogLevel.None,
  warn: ExtractorLogLevel.Warning,
}

/** @alpha */
export function getExtractMessagesConfig(options: {
  rules: NonNullable<PkgConfigOptions['extract']>['rules']
  disabled?: boolean
}): IExtractorMessagesConfig {
  const {rules, disabled = false} = options

  function ruleToLogLevel(
    key: keyof NonNullable<NonNullable<PkgConfigOptions['extract']>['rules']>,
    defaultLevel?: ExtractorLogLevel,
  ) {
    const r = rules?.[key]

    return r ? LOG_LEVELS[r] : defaultLevel || ExtractorLogLevel.Warning
  }

  return {
    compilerMessageReporting: {
      default: {
        logLevel: disabled ? ExtractorLogLevel.None : ExtractorLogLevel.Warning,
      },
    },

    extractorMessageReporting: disabled
      ? {
          default: {
            logLevel: ExtractorLogLevel.None,
            addToApiReportFile: false,
          },
        }
      : {
          'default': {
            logLevel: ExtractorLogLevel.Warning,
            addToApiReportFile: false,
          },

          'ae-forgotten-export': {
            /**
             * This is hardcoded to `none` as it's no longer needed since TypeScript 5.5 https://github.com/microsoft/TypeScript/issues/42873
             * It's hardcoded to `none` since supported by API Extractor when using `module: 'Preserve'` doesn't support it well since `@microsoft/api-extractor` v7.49.0, which upgraded from TS 5.4 to 5.7 internally
             */
            logLevel: ExtractorLogLevel.None,
            addToApiReportFile: false,
          },

          'ae-incompatible-release-tags': {
            logLevel: ruleToLogLevel('ae-incompatible-release-tags', ExtractorLogLevel.Error),
            addToApiReportFile: false,
          },

          'ae-internal-missing-underscore': {
            logLevel: ruleToLogLevel('ae-internal-missing-underscore'),
            addToApiReportFile: false,
          },

          'ae-missing-release-tag': {
            logLevel: ruleToLogLevel('ae-missing-release-tag', ExtractorLogLevel.Error),
            addToApiReportFile: false,
          },

          'ae-wrong-input-file-type': {
            logLevel: ExtractorLogLevel.None,
            addToApiReportFile: false,
          },
        },

    tsdocMessageReporting: disabled
      ? {
          default: {
            logLevel: ExtractorLogLevel.None,
            addToApiReportFile: false,
          },
        }
      : {
          'default': {
            logLevel: ExtractorLogLevel.Warning,
            addToApiReportFile: false,
          },

          'tsdoc-link-tag-unescaped-text': {
            logLevel: ruleToLogLevel('tsdoc-link-tag-unescaped-text', ExtractorLogLevel.Warning),
            addToApiReportFile: false,
          },

          'tsdoc-undefined-tag': {
            logLevel: ruleToLogLevel('tsdoc-undefined-tag', ExtractorLogLevel.Error),
            addToApiReportFile: false,
          },

          'tsdoc-unsupported-tag': {
            logLevel: ruleToLogLevel('tsdoc-unsupported-tag', ExtractorLogLevel.None),
            addToApiReportFile: false,
          },
        },
  }
}
