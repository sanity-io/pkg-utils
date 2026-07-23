/**
 * esbuild-style target parsing ported from `@tsdown/css`
 * (https://github.com/rolldown/tsdown/blob/main/packages/css/src/lightningcss.ts),
 * MIT licensed, Copyright (c) 2025-present VoidZero Inc. & Contributors,
 * Copyright (c) 2024 Kevin Deng, so the plugin's `target` option accepts the
 * same values as tsdown's `css.target` / top-level `target` options.
 */
import type {Targets} from 'lightningcss'

const ESBUILD_LIGHTNINGCSS_MAPPING: Record<string, keyof Targets> = {
  chrome: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
  ie: 'ie',
  ios: 'ios_saf',
  opera: 'opera',
  safari: 'safari',
}

function parseVersion(version: string): number | null {
  const [major = Number.NaN, minor = 0, patch = 0] = (version.split('-', 1)[0] ?? version)
    .split('.')
    .map((v) => Number.parseInt(v, 10))

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    return null
  }

  return (major << 16) | (minor << 8) | patch
}

/**
 * Convert esbuild-style target strings (e.g. `'chrome90'`, `'safari16.2'`) into lightningcss
 * `Targets`, with the same conversion as `css.target` in `@tsdown/css`. Targets that don't map
 * to a browser (e.g. `'node20'`, `'es2022'`) are ignored — `undefined` is returned when none of
 * them do, which hosts like `@sanity/tsdown-config` use to detect browserless targets and layer
 * their own default targets on top.
 * @public
 */
export function esbuildTargetToLightningCSS(target: string | string[]): Targets | undefined {
  return convert(Array.isArray(target) ? target : [target])
}

function convert(target: string[]): Targets | undefined {
  let targets: Targets | undefined

  const targetString = target.join(' ').toLowerCase()
  const entries = targetString.split(/[\s,]+/)

  for (const entry of entries) {
    if (entry.length === 0) {
      continue
    }
    const index = entry.search(/\d/)
    if (index <= 0) {
      continue
    }

    const name = entry.slice(0, index)
    const version = entry.slice(index)
    const browser = ESBUILD_LIGHTNINGCSS_MAPPING[name]
    if (!browser || !isVersionString(version)) {
      continue
    }

    const versionInt = parseVersion(version)
    if (versionInt == null) {
      continue
    }

    targets = targets || {}
    targets[browser] = versionInt
  }

  return targets
}

function isVersionString(version: string): boolean {
  if (version.startsWith('.') || version.endsWith('.')) {
    return false
  }

  let lastWasDot = false
  for (const char of version) {
    if (char === '.') {
      if (lastWasDot) {
        return false
      }
      lastWasDot = true
      continue
    }
    if (char < '0' || char > '9') {
      return false
    }
    lastWasDot = false
  }

  return true
}
