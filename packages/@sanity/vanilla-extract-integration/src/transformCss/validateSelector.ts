/**
 * Ported from `@vanilla-extract/css` (MIT licensed, Copyright (c) 2021 SEEK):
 * `packages/css/src/validateSelector.ts`, with the `dedent` dependency replaced by a plain
 * string.
 */
import {parse, SelectorType} from 'css-what'
import {cssesc} from './cssesc.ts'
import {escapeRegex} from './utils.ts'

type Selector = ReturnType<typeof parse>[number]

function targetsClassName(tokens: Selector, targetClassName: string): boolean {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]

    if (!token) {
      continue
    }

    if (
      token.type === SelectorType.Child ||
      token.type === SelectorType.Parent ||
      token.type === SelectorType.Sibling ||
      token.type === SelectorType.Adjacent ||
      token.type === SelectorType.Descendant
    ) {
      return false
    }

    if (
      token.type === SelectorType.Attribute &&
      token.name === 'class' &&
      token.value === targetClassName
    ) {
      return true
    }

    if (
      token.type === SelectorType.Pseudo &&
      Array.isArray(token.data) &&
      (token.name === 'is' || token.name === 'where')
    ) {
      if (token.data.every((sub) => targetsClassName(sub, targetClassName))) {
        return true
      }
    }
  }

  return false
}

export const validateSelector = (selector: string, targetClassName: string): void => {
  const replaceTarget = () => {
    const targetRegex = new RegExp(
      `.${escapeRegex(cssesc(targetClassName, {isIdentifier: true}))}`,
      'g',
    )
    return selector.replace(targetRegex, '&')
  }

  let selectorParts: ReturnType<typeof parse>

  try {
    selectorParts = parse(selector)
  } catch (err) {
    throw new Error(`Invalid selector: ${replaceTarget()}`, {cause: err})
  }

  selectorParts.forEach((tokens) => {
    if (!targetsClassName(tokens, targetClassName)) {
      throw new Error(
        [
          `Invalid selector: ${replaceTarget()}`,
          '',
          "Style selectors must target the '&' character (along with any modifiers), e.g. `${parent} &` or `${parent} &:hover`.",
          '',
          'This is to ensure that each style block only affects the styling of a single class.',
          '',
          "If your selector is targeting another class, you should move it to the style definition for that class, e.g. given we have styles for 'parent' and 'child' elements, instead of adding a selector of `& ${child}`) to 'parent', you should add `${parent} &` to 'child').",
          '',
          "If your selector is targeting something global, use the 'globalStyle' function instead, e.g. if you wanted to write `& h1`, you should instead write 'globalStyle(`${parent} h1`, { ... })'",
        ].join('\n'),
      )
    }
  })
}
