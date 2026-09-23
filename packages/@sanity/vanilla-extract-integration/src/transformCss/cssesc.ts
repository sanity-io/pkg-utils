/**
 * Ported from `@vanilla-extract/css` (MIT licensed, Copyright (c) 2021 SEEK), which itself
 * vendors cssesc (MIT licensed, Copyright Mathias Bynens):
 * https://github.com/mathiasbynens/cssesc/blob/cb894eb42f27c8d3cd793f16afe35b3ab38000a1/cssesc.js
 */

/* oxlint-disable no-control-regex */

const regexAnySingleEscape = /[ -,./:-@[-^`{-~]/
const regexSingleEscape = /[ -,./:-@[\]^`{-~]/
const regexExcessiveSpaces = /(^|\\+)?(\\[A-F0-9]{1,6})\x20(?![a-fA-F0-9\x20])/g

interface CssescOptions {
  escapeEverything: boolean
  isIdentifier: boolean
  quotes: 'single' | 'double'
  wrap: boolean
}

const DEFAULT_OPTIONS: CssescOptions = {
  escapeEverything: false,
  isIdentifier: false,
  quotes: 'single',
  wrap: false,
}

export function cssesc(string: string, userOptions: Partial<CssescOptions> = {}): string {
  const options: CssescOptions = {...DEFAULT_OPTIONS, ...userOptions}
  const quote = options.quotes === 'double' ? '"' : "'"
  const {isIdentifier} = options

  const firstChar = string.charAt(0)
  let output = ''
  let counter = 0
  const length = string.length
  while (counter < length) {
    const character = string.charAt(counter++)
    let codePoint = character.charCodeAt(0)
    let value: string
    // If it’s not a printable ASCII character…
    if (codePoint < 0x20 || codePoint > 0x7e) {
      if (codePoint >= 0xd800 && codePoint <= 0xdbff && counter < length) {
        // It’s a high surrogate, and there is a next character.
        const extra = string.charCodeAt(counter++)
        if ((extra & 0xfc00) === 0xdc00) {
          // next character is low surrogate
          codePoint = ((codePoint & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000
        } else {
          // It’s an unmatched surrogate; only append this code unit, in case
          // the next code unit is the high surrogate of a surrogate pair.
          counter--
        }
      }
      value = `\\${codePoint.toString(16).toUpperCase()} `
    } else if (options.escapeEverything) {
      if (regexAnySingleEscape.test(character)) {
        value = `\\${character}`
      } else {
        value = `\\${codePoint.toString(16).toUpperCase()} `
      }
    } else if (/[\t\n\f\r\x0B]/.test(character)) {
      value = `\\${codePoint.toString(16).toUpperCase()} `
    } else if (
      character === '\\' ||
      (!isIdentifier &&
        ((character === '"' && quote === character) ||
          (character === "'" && quote === character))) ||
      (isIdentifier && regexSingleEscape.test(character))
    ) {
      value = `\\${character}`
    } else {
      value = character
    }
    output += value
  }

  if (isIdentifier) {
    if (/^-[-\d]/.test(output)) {
      output = `\\-${output.slice(1)}`
    } else if (/\d/.test(firstChar)) {
      output = `\\3${firstChar} ${output.slice(1)}`
    }
  }

  // Remove spaces after `\HEX` escapes that are not followed by a hex digit,
  // since they’re redundant. Note that this is only possible if the escape
  // sequence isn’t preceded by an odd number of backslashes.
  output = output.replace(
    regexExcessiveSpaces,
    ($0: string, $1: string | undefined, $2: string) => {
      if ($1 && $1.length % 2) {
        // It’s not safe to remove the space, so don’t.
        return $0
      }
      // Strip the space.
      return ($1 || '') + $2
    },
  )

  if (!isIdentifier && options.wrap) {
    return quote + output + quote
  }
  return output
}
