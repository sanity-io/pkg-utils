/**
 * Structural comparison between the fork (`@sanity/vanilla-extract-vite-plugin`) and the
 * upstream reference (`@vanilla-extract/vite-plugin`).
 *
 * The fork salts its file-scope hash with the package version and the `.css.ts` module's
 * content (SAPP-4639), while upstream hashes the bare `packageName + filePath` — so the two
 * implementations legitimately emit *different* class names for the same styles. Exact
 * equality would only hold by hash collision. These helpers align the two sides' class names
 * positionally (per export, per composition slot) and normalize both outputs onto shared
 * placeholders, so the tests compare everything *except* the salted hash values: the same
 * exports, the same compositions, the same CSS rules.
 */
import type {FixtureClassNames} from './helpers.ts'

/** Each side's class names mapped onto the same shared placeholders. */
export interface ClassAlignment {
  forkToPlaceholder: Map<string, string>
  upstreamToPlaceholder: Map<string, string>
}

function placeholder(index: number): string {
  return `__VE_CLASS_${index}__`
}

/**
 * Aligns two class-name records (export name → space-separated class list) positionally:
 * both sides must export the same names with the same number of classes per export, and the
 * i-th class of each export maps onto one shared placeholder. Throws when the shapes differ —
 * that is a real fork/upstream divergence, not a hash difference.
 */
export function alignClassRecords(
  fork: Record<string, string>,
  upstream: Record<string, string>,
): ClassAlignment {
  const forkKeys = Object.keys(fork).toSorted()
  const upstreamKeys = Object.keys(upstream).toSorted()
  if (JSON.stringify(forkKeys) !== JSON.stringify(upstreamKeys)) {
    throw new Error(
      `Class-name exports differ: fork [${forkKeys.join(', ')}] vs upstream [${upstreamKeys.join(', ')}]`,
    )
  }

  const forkToPlaceholder = new Map<string, string>()
  const upstreamToPlaceholder = new Map<string, string>()
  let nextIndex = 0

  for (const key of forkKeys) {
    const forkList = fork[key]!.split(' ')
    const upstreamList = upstream[key]!.split(' ')
    if (forkList.length !== upstreamList.length) {
      throw new Error(
        `Class list of "${key}" differs: fork "${forkList.join(' ')}" vs upstream "${upstreamList.join(' ')}"`,
      )
    }
    for (let index = 0; index < forkList.length; index++) {
      const forkClass = forkList[index]!
      const upstreamClass = upstreamList[index]!
      const forkKnown = forkToPlaceholder.has(forkClass)
      const upstreamKnown = upstreamToPlaceholder.has(upstreamClass)
      if (forkKnown !== upstreamKnown) {
        throw new Error(
          `Class sharing differs at "${key}"[${index}]: fork "${forkClass}" vs upstream "${upstreamClass}"`,
        )
      }
      if (!forkKnown && !upstreamKnown) {
        const shared = placeholder(nextIndex++)
        forkToPlaceholder.set(forkClass, shared)
        upstreamToPlaceholder.set(upstreamClass, shared)
      }
    }
  }

  return {forkToPlaceholder, upstreamToPlaceholder}
}

/** {@link alignClassRecords} for the fixture's `dialog`/`overlay`/`button` exports. */
export function alignFixtureClasses(
  fork: FixtureClassNames,
  upstream: FixtureClassNames,
): ClassAlignment {
  return alignClassRecords({...fork}, {...upstream})
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replaces every mapped class name in `text` with its placeholder in a single pass. Matches
 * are longest-first with identifier boundaries, so shared prefixes between classes (e.g. a
 * debug hash that prefixes another class) and placeholders can never be re-matched.
 */
export function replaceClasses(text: string, mapping: Map<string, string>): string {
  if (mapping.size === 0) return text
  const pattern = [...mapping.keys()]
    .toSorted((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')
  return text.replace(
    new RegExp(`(?<![A-Za-z0-9_-])(?:${pattern})(?![A-Za-z0-9_-])`, 'g'),
    (match) => mapping.get(match) ?? match,
  )
}

/** Normalizes a class-name record through its placeholder mapping. */
export function normalizeClassRecord(
  record: Record<string, string>,
  mapping: Map<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, classList]) => [
      key,
      classList
        .split(' ')
        .map((className) => mapping.get(className) ?? className)
        .join(' '),
    ]),
  )
}
