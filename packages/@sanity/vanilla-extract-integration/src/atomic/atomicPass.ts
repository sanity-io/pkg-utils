/**
 * The atomic pass: which declarations of a stylesheet can share one single-declaration class
 * without changing what any element renders as.
 *
 * Every declaration of a `style()` rule whose selector targets the style's own class once
 * (`.a`, `.a:hover`, `.a.a`, `.parent .a`) is split into an atomic declaration. Two atomic
 * declarations with the same key — conditions, selector template, property and value — may
 * share one rule (and so one class) if, and only if, no declaration whose property overlaps
 * theirs (see {@link propertiesOverlap}) with the same importance in the same cascade layer is
 * rendered between them. Sharing moves a declaration to the position of the first occurrence;
 * with nothing in between that could beat one occurrence but not the other, every combination
 * of classes on an element resolves to the same winner as before. This is the exact condition:
 * whenever it fails, some pair of styles combined on one element would flip.
 *
 * The analysis runs over the rendering order, so it also sees every non-atomic declaration
 * (`globalStyle`, complex `selectors`, themes) as a potential barrier. It never assumes media,
 * container or supports queries are mutually exclusive, and ignores specificity differences —
 * both only ever make it more conservative.
 */
import type {FileScope} from '@vanilla-extract/css'
import {hash} from '../hash.ts'
import {cssesc} from '../transformCss/cssesc.ts'
import type {IdentifierOption} from '../types.ts'
import {propertiesOverlap} from './propertyGroups.ts'

/** @public */
export interface AtomicOptions {
  /**
   * Distinguishes the class names of separately rendered stylesheets (per-module rendering
   * names atomics per file scope; whole-program rendering shares one scope), so identical
   * declarations in independently ordered stylesheets never share a class by accident.
   */
  scopeKey: string
  /** How atomic class names are spelled, like the `identifiers` option of the plugins. */
  identOption: IdentifierOption
  /** The file scope a custom `identOption` function is told about (per-module rendering). */
  fileScope?: FileScope
}

/** One atomic declaration, as split off a `style()` rule by the renderer. */
export interface AtomicDeclaration {
  /** The style's own class, whose exported class list gains the atomic class. */
  identity: string
  /** The rendered selector with the identity class replaced by `&`. */
  template: string
  /** The at-rule path the declaration is rendered under (`@media …`, `@layer …`, …). */
  conditions: ReadonlyArray<string>
  property: string
  value: unknown
}

/** A declaration in rendering order: atomic ones carry their {@link AtomicDeclaration}. */
export interface RenderedDeclaration {
  property: string
  value: unknown
  conditions: ReadonlyArray<string>
  atomic?: AtomicDeclaration
}

/** The pass's decision for one rendered declaration. */
export interface AtomicDecision {
  /** The class the declaration renders under. */
  className: string
  /** Whether an earlier declaration already renders this rule, so this one is dropped. */
  shared: boolean
}

/** @public */
export interface AtomicReport {
  /** Declarations of `style()` rules that were split into atomic classes. */
  atomicDeclarations: number
  /** Declarations that stayed on their identity class (complex selectors, globals, ...). */
  residualDeclarations: number
  /** Atomic declarations dropped because an earlier identical one is shared. */
  sharedDeclarations: number
  /** Distinct atomic classes rendered. */
  atomicClasses: number
}

const layerKeyOf = (conditions: ReadonlyArray<string>): string =>
  conditions.filter((condition) => condition.startsWith('@layer ')).join(' / ')

const isImportant = (value: unknown): boolean =>
  typeof value === 'string'
    ? value.includes('!important')
    : Array.isArray(value) && value.some((entry) => String(entry).includes('!important'))

const declarationKey = (declaration: AtomicDeclaration): string =>
  JSON.stringify([
    declaration.conditions,
    declaration.template,
    declaration.property,
    declaration.value,
  ])

/** A run of identical atomic declarations sharing one class, open until a barrier closes it. */
interface Run {
  key: string
  className: string
  /** The property whose overlaps close the run (same as every member's). */
  property: string
  layerKey: string
  important: boolean
  open: boolean
}

const slug = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)

/**
 * Plans the atomic classes for a stylesheet's declarations in rendering order. Returns one
 * decision per atomic declaration (indexed like the input) plus the identity → atomic class
 * expansions for the serializer.
 */
export function planAtomicClasses(
  declarations: ReadonlyArray<RenderedDeclaration>,
  options: AtomicOptions,
): {
  decisions: Map<number, AtomicDecision>
  expansions: Map<string, string[]>
  report: AtomicReport
} {
  const decisions = new Map<number, AtomicDecision>()
  const expansions = new Map<string, string[]>()
  const runsByKey = new Map<string, Run>()
  const runCounts = new Map<string, number>()
  /** Open runs, indexed by the physical longhands their property overlaps is checked against. */
  const openRuns = new Set<Run>()
  const report: AtomicReport = {
    atomicDeclarations: 0,
    residualDeclarations: 0,
    sharedDeclarations: 0,
    atomicClasses: 0,
  }

  const closeOverlappingRuns = (declaration: RenderedDeclaration, exceptKey?: string) => {
    const layerKey = layerKeyOf(declaration.conditions)
    const important = isImportant(declaration.value)
    for (const run of openRuns) {
      if (run.key === exceptKey) continue
      if (run.layerKey !== layerKey || run.important !== important) continue
      if (propertiesOverlap(run.property, declaration.property)) {
        run.open = false
        openRuns.delete(run)
      }
    }
  }

  const className = (declaration: AtomicDeclaration, key: string, runIndex: number): string => {
    const hashed = hash(`${options.scopeKey}|${key}${runIndex > 0 ? `|${runIndex}` : ''}`)
      .replaceAll(/[^a-z0-9]/gi, '')
      .slice(0, 8)
    const debugId = `${slug(declaration.property)}_${slug(String(declaration.value)) || 'empty'}`
    if (options.identOption === 'debug') return `${debugId}__${hashed}`
    if (typeof options.identOption === 'function') {
      const identifier = options.identOption({
        hash: hashed,
        debugId,
        filePath: options.fileScope?.filePath ?? '',
        ...(options.fileScope?.packageName === undefined
          ? {}
          : {packageName: options.fileScope.packageName}),
      })
      if (!/^[A-Z_][0-9A-Z_-]+$/i.test(identifier)) {
        throw new Error(`Identifier function returned invalid indentifier: "${identifier}"`)
      }
      return identifier
    }
    return `_a${hashed}`
  }

  for (const [index, declaration] of declarations.entries()) {
    const {atomic} = declaration
    if (!atomic) {
      report.residualDeclarations++
      closeOverlappingRuns(declaration)
      continue
    }

    report.atomicDeclarations++
    const key = declarationKey(atomic)
    let run = runsByKey.get(key)
    if (run?.open) {
      // No barrier since the run's last member: the earlier rule already covers this one
      decisions.set(index, {className: run.className, shared: true})
      report.sharedDeclarations++
    } else {
      const runIndex = runCounts.get(key) ?? 0
      runCounts.set(key, runIndex + 1)
      run = {
        key,
        className: className(atomic, key, runIndex),
        property: atomic.property,
        layerKey: layerKeyOf(atomic.conditions),
        important: isImportant(atomic.value),
        open: true,
      }
      runsByKey.set(key, run)
      openRuns.add(run)
      decisions.set(index, {className: run.className, shared: false})
      report.atomicClasses++
    }

    // This declaration is itself a barrier for every other overlapping run
    closeOverlappingRuns(declaration, key)

    const classes = expansions.get(atomic.identity) ?? []
    if (!classes.includes(run.className)) classes.push(run.className)
    expansions.set(atomic.identity, classes)
  }

  return {decisions, expansions, report}
}

/**
 * The selector template of a rendered selector relative to its style's class: `.a:hover` →
 * `&:hover`, `.parent .a` → `.parent &`. Returns `undefined` when the class appears more than
 * once across compounds (`.a + .a`), where sharing the class would make unrelated elements
 * match, or not at all.
 */
export function selectorTemplate(selector: string, identity: string): string | undefined {
  const escaped = cssesc(identity, {isIdentifier: true}).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const identityPattern = new RegExp(`\\.${escaped}(?![\\w-])`, 'g')
  const template = selector.replace(identityPattern, '&')
  const occurrences = template.split('&').length - 1
  if (occurrences === 1) return template
  if (occurrences === 0) return undefined
  // `&&`-style specificity bumps stay within one compound, so they are safe to share
  return /^&{2,}(?:::?[\w-]+(?:\([^()]*\))?)*$/.test(template) ? template : undefined
}

/** Renders a selector template for a class: `&:hover` + `x1` → `.x1:hover`. */
export function renderTemplate(template: string, className: string): string {
  return template.replaceAll('&', `.${cssesc(className, {isIdentifier: true})}`)
}
