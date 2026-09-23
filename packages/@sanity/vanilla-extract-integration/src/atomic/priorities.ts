/**
 * StyleX's cascade priority scheme, computed from this package's own property tables — the
 * building block of the planned `atomic: 'priority'` mode (see `docs/atomic-priority-mode.md`),
 * in which every atomic rule is sorted by priority and wrapped in a `@layer priority<N>` block,
 * so that longhands always beat shorthands and pseudo-classes / at-rules order themselves
 * regardless of source order and of which chunk a rule ships in.
 *
 * The numbers are StyleX's (`packages/@stylexjs/shared/src/utils/property-priorities.js`, MIT
 * licensed, Copyright (c) Meta Platforms, Inc.): a property's base priority by how much of the
 * cascade it reaches, plus the priorities of every pseudo and at-rule it renders under.
 */
import {
  directLonghands,
  hasLogicalCounterpart,
  isLogicalLonghand,
  isShorthand,
} from './propertyGroups.ts'

/**
 * Pseudo-class priorities, in lvfha order (`:link` < `:visited` < `:focus` < `:hover` < `:active`)
 * and friends. StyleX keys `:focus-within` / `:focus-visible` in camelCase (`:focusWithin`),
 * which is a spelling its own users cannot write; this table uses the CSS spellings.
 */
export const PSEUDO_CLASS_PRIORITIES: Readonly<Record<string, number>> = {
  ':is': 40,
  ':where': 40,
  ':not': 40,
  ':has': 45,
  ':dir': 50,
  ':lang': 51,
  ':first-child': 52,
  ':first-of-type': 53,
  ':last-child': 54,
  ':last-of-type': 55,
  ':only-child': 56,
  ':only-of-type': 57,
  ':nth-child': 60,
  ':nth-last-child': 61,
  ':nth-of-type': 62,
  ':nth-last-of-type': 63,
  ':empty': 70,
  ':link': 80,
  ':any-link': 81,
  ':local-link': 82,
  ':target-within': 83,
  ':target': 84,
  ':visited': 85,
  ':enabled': 91,
  ':disabled': 92,
  ':required': 93,
  ':optional': 94,
  ':read-only': 95,
  ':read-write': 96,
  ':placeholder-shown': 97,
  ':in-range': 98,
  ':out-of-range': 99,
  ':default': 100,
  ':checked': 101,
  ':indeterminate': 101,
  ':blank': 102,
  ':valid': 103,
  ':invalid': 104,
  ':user-invalid': 105,
  ':autofill': 110,
  ':picture-in-picture': 120,
  ':modal': 121,
  ':fullscreen': 122,
  ':paused': 123,
  ':playing': 124,
  ':current': 125,
  ':past': 126,
  ':future': 127,
  ':hover': 130,
  ':focus-within': 140,
  ':focus': 150,
  ':focus-visible': 160,
  ':active': 170,
}

/** At-rule priorities; other at-rules (`@layer`, `@starting-style`) do not move a rule. */
export const AT_RULE_PRIORITIES: Readonly<Record<string, number>> = {
  '@supports': 30,
  '@media': 200,
  '@container': 300,
}

export const PSEUDO_ELEMENT_PRIORITY = 5000

/** Unknown pseudo-classes rank with `:is`/`:where`/`:not`. */
const DEFAULT_PSEUDO_CLASS_PRIORITY = 40

const CUSTOM_PROPERTY_PRIORITY = 1
const SHORTHAND_OF_SHORTHANDS_PRIORITY = 1000
const SHORTHAND_PRIORITY = 2000
const LONGHAND_PRIORITY = 3000
const PHYSICAL_LONGHAND_PRIORITY = 4000

/**
 * Shorthands whose sub-shorthands the generated table cannot show, because `mdn-data` lists the
 * longhands a shorthand computes to rather than the shorthands it sets: `animation` resets
 * `animationRange`, `grid` sets `gridTemplate`, `gridArea` sets `gridRow` and `gridColumn`.
 */
const SHORTHANDS_OF_SHORTHANDS = new Set(['all', 'animation', 'grid', 'gridArea'])

/** `margin` → `marginBlock` / `marginInline`: the logical sub-shorthands of a sided shorthand. */
const hasLogicalSubShorthand = (property: string): boolean =>
  isShorthand(`${property}Block`) && isShorthand(`${property}Inline`)

/**
 * Whether a shorthand sets other shorthands (`border` → `borderWidth`, `margin` → `marginBlock`),
 * and so must rank below them.
 */
export function isShorthandOfShorthands(property: string): boolean {
  if (!isShorthand(property)) return false
  return (
    SHORTHANDS_OF_SHORTHANDS.has(property) ||
    hasLogicalSubShorthand(property) ||
    directLonghands(property).some((longhand) => isShorthand(longhand))
  )
}

/**
 * A property's base priority, by how much of the cascade it reaches: `--custom` 1, shorthands
 * that set other shorthands (`border`, `margin`, `all`) 1000, other shorthands 2000, logical and
 * unclassified longhands 3000, physical longhands with a logical counterpart 4000 — so that
 * `margin` < `marginBlock` < `marginBlockStart` < `marginTop` whatever the source order.
 * @public
 */
export function propertyPriority(property: string): number {
  if (property.startsWith('--')) return CUSTOM_PROPERTY_PRIORITY
  if (isShorthandOfShorthands(property)) return SHORTHAND_OF_SHORTHANDS_PRIORITY
  if (isShorthand(property)) return SHORTHAND_PRIORITY
  if (isLogicalLonghand(property)) return LONGHAND_PRIORITY
  return hasLogicalCounterpart(property) ? PHYSICAL_LONGHAND_PRIORITY : LONGHAND_PRIORITY
}

/** The priority of one at-rule condition (`'@media (min-width: 600px)'` → 200). */
export function conditionPriority(condition: string): number {
  const atRule = /^@[a-zA-Z-]+/.exec(condition)?.[0]
  return atRule === undefined ? 0 : (AT_RULE_PRIORITIES[atRule] ?? 0)
}

/** `::before`, `:hover`, `:nth-child(2n)`: the pseudos of a compound selector, in order. */
const PSEUDO_PART_REGEX = /::[a-zA-Z-]+|:[a-zA-Z-]+(?:\([^)]*\))?/g

/** The priority of one pseudo (`:hover` 130, `:nth-child(2n)` 60, `::before` 5000). */
function pseudoPriority(pseudo: string): number {
  if (pseudo.startsWith('::')) return PSEUDO_ELEMENT_PRIORITY
  const name = pseudo.split('(')[0] ?? pseudo
  return PSEUDO_CLASS_PRIORITIES[name] ?? DEFAULT_PSEUDO_CLASS_PRIORITY
}

/**
 * The priority of a `&`-rooted selector template, summing its pseudos like StyleX does for
 * compound keys (`&:hover::before` → 5130). `&` itself is 0; anything the template says besides
 * pseudos (`.parent &`, `& + &`) has no StyleX equivalent and does not contribute.
 */
export function selectorPriority(selector: string): number {
  if (selector === '&') return 0
  let total = 0
  for (const [pseudo] of selector.matchAll(PSEUDO_PART_REGEX)) total += pseudoPriority(pseudo)
  return total
}

export interface DeclarationPriorityInput {
  property: string
  /** The at-rule conditions the declaration renders under, outermost first. */
  conditions?: ReadonlyArray<string>
  /** The `&`-rooted selector template it renders on; `'&'` (the default) for the class itself. */
  selector?: string
}

/**
 * The cascade priority of a declaration: its property's base priority plus every pseudo and
 * at-rule it renders under, StyleX-style (`padding` under `&:hover` → 1130, `paddingTop` under
 * `@media` → 4200).
 * @public
 */
export function declarationPriority({
  property,
  conditions = [],
  selector = '&',
}: DeclarationPriorityInput): number {
  let total = propertyPriority(property) + selectorPriority(selector)
  for (const condition of conditions) total += conditionPriority(condition)
  return total
}

/** The `@layer priority<N>` a priority belongs to: its thousands (`4200` → `priority4`). */
export function priorityLayer(priority: number): string {
  return `priority${Math.floor(priority / 1000)}`
}
