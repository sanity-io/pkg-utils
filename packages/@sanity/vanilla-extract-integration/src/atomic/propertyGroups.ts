/**
 * Which CSS properties can set the same physical longhand — the "overlap" relation the atomic
 * pass uses to decide whether two declarations compete in the cascade.
 *
 * Two declarations only ever conflict when their properties overlap: the same property, a
 * shorthand and one of its longhands (`padding` / `paddingBottom`), two shorthands sharing a
 * longhand (`border` / `borderColor`), or a logical and a physical longhand that resolve to the
 * same side (`marginInlineStart` / `marginLeft`). Logical longhands are treated as overlapping
 * every physical side of their group, since which side they map to depends on the writing mode
 * of the element, which is unknown at build time.
 *
 * The shorthand table is generated from `mdn-data` (`propertyGroups.generated.ts`); the
 * logical ↔ physical groups and the aliases are maintained here.
 */
import {SHORTHAND_LONGHANDS} from './propertyGroups.generated.ts'

const PHYSICAL_SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const
const LOGICAL_SIDES = ['BlockStart', 'BlockEnd', 'InlineStart', 'InlineEnd'] as const

/** `{marginBlockStart: [marginTop, marginRight, marginBottom, marginLeft], …}` for one group. */
function sidedGroup(prefix: string, suffix = ''): Record<string, ReadonlyArray<string>> {
  const physical = PHYSICAL_SIDES.map((side) => `${prefix}${side}${suffix}`)
  return Object.fromEntries(LOGICAL_SIDES.map((side) => [`${prefix}${side}${suffix}`, physical]))
}

/** `{inlineSize: [width, height], blockSize: [width, height]}` for one size group. */
function sizeGroup(
  inline: string,
  block: string,
  physical: ReadonlyArray<string>,
): Record<string, ReadonlyArray<string>> {
  return {[inline]: physical, [block]: physical}
}

const RADIUS_CORNERS = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
]

const SHAPE_CORNERS = [
  'cornerTopLeftShape',
  'cornerTopRightShape',
  'cornerBottomRightShape',
  'cornerBottomLeftShape',
]

/** Logical longhands and every physical longhand they can resolve to. */
const LOGICAL_TO_PHYSICAL: Readonly<Record<string, ReadonlyArray<string>>> = {
  ...sidedGroup('margin'),
  ...sidedGroup('padding'),
  ...sidedGroup('scrollMargin'),
  ...sidedGroup('scrollPadding'),
  ...sidedGroup('border', 'Width'),
  ...sidedGroup('border', 'Style'),
  ...sidedGroup('border', 'Color'),
  ...Object.fromEntries(
    LOGICAL_SIDES.map((side) => [`inset${side}`, ['top', 'right', 'bottom', 'left']]),
  ),
  borderStartStartRadius: RADIUS_CORNERS,
  borderStartEndRadius: RADIUS_CORNERS,
  borderEndStartRadius: RADIUS_CORNERS,
  borderEndEndRadius: RADIUS_CORNERS,
  cornerStartStartShape: SHAPE_CORNERS,
  cornerStartEndShape: SHAPE_CORNERS,
  cornerEndStartShape: SHAPE_CORNERS,
  cornerEndEndShape: SHAPE_CORNERS,
  ...sizeGroup('inlineSize', 'blockSize', ['width', 'height']),
  ...sizeGroup('minInlineSize', 'minBlockSize', ['minWidth', 'minHeight']),
  ...sizeGroup('maxInlineSize', 'maxBlockSize', ['maxWidth', 'maxHeight']),
  ...sizeGroup('overflowInline', 'overflowBlock', ['overflowX', 'overflowY']),
  ...sizeGroup('overscrollBehaviorInline', 'overscrollBehaviorBlock', [
    'overscrollBehaviorX',
    'overscrollBehaviorY',
  ]),
  ...sizeGroup('containIntrinsicInlineSize', 'containIntrinsicBlockSize', [
    'containIntrinsicWidth',
    'containIntrinsicHeight',
  ]),
}

/** Properties that are spellings of another property (browsers treat them as the same one). */
const ALIASES: Readonly<Record<string, string>> = {
  gridGap: 'gap',
  gridRowGap: 'rowGap',
  gridColumnGap: 'columnGap',
  wordWrap: 'overflowWrap',
}

/** The properties `all` does not reset. */
const ALL_EXCLUDED = new Set(['direction', 'unicodeBidi'])

/** Every property name the tables know, to recognize unprefixed counterparts of vendor spellings. */
const KNOWN_PROPERTIES = new Set([
  ...Object.keys(SHORTHAND_LONGHANDS),
  ...Object.values(SHORTHAND_LONGHANDS).flat(),
  ...Object.keys(LOGICAL_TO_PHYSICAL),
  ...Object.values(LOGICAL_TO_PHYSICAL).flat(),
])

const isCustomProperty = (property: string): boolean => property.startsWith('--')

/** `WebkitTransition` → `transition` when the unprefixed property is known; otherwise as-is. */
function canonicalName(property: string): string {
  const alias = ALIASES[property]
  if (alias) return alias
  const match = /^(?:Webkit|Moz|O|ms)([A-Z].*)$/.exec(property)
  const rest = match?.[1]
  if (!rest) return property
  const candidate = `${rest[0]?.toLowerCase() ?? ''}${rest.slice(1)}`
  return KNOWN_PROPERTIES.has(candidate) ? candidate : property
}

const expansionCache = new Map<string, ReadonlySet<string>>()

/**
 * The physical longhands a property sets, following shorthands (recursively) and logical
 * properties (to every side they can resolve to). A longhand expands to itself, `all` to the
 * marker `'*'`, and custom properties (`--x`) to themselves.
 * @public
 */
export function physicalLonghands(property: string): ReadonlySet<string> {
  const cached = expansionCache.get(property)
  if (cached) return cached

  const result = new Set<string>()
  const seen = new Set<string>()
  const stack = [property]
  for (let name = stack.pop(); name !== undefined; name = stack.pop()) {
    const canonical = canonicalName(name)
    if (seen.has(canonical)) continue
    seen.add(canonical)

    if (canonical === 'all') {
      result.add('*')
      continue
    }
    const longhands = SHORTHAND_LONGHANDS[canonical]
    if (longhands) {
      stack.push(...longhands)
      continue
    }
    const physical = LOGICAL_TO_PHYSICAL[canonical]
    if (physical) {
      for (const side of physical) result.add(side)
      continue
    }
    result.add(canonical)
  }

  expansionCache.set(property, result)
  return result
}

function isExcludedFromAll(longhands: ReadonlySet<string>): boolean {
  for (const longhand of longhands) {
    if (!ALL_EXCLUDED.has(longhand)) return false
  }
  return true
}

/**
 * Whether declarations of the two properties can set the same physical longhand, and so
 * compete in the cascade when both apply to an element.
 * @public
 */
export function propertiesOverlap(a: string, b: string): boolean {
  if (a === b) return true
  if (isCustomProperty(a) || isCustomProperty(b)) return false

  const left = physicalLonghands(a)
  const right = physicalLonghands(b)
  if (left.has('*')) return !isExcludedFromAll(right)
  if (right.has('*')) return !isExcludedFromAll(left)

  for (const longhand of left) {
    if (right.has(longhand)) return true
  }
  return false
}

/** Whether a property is a shorthand (sets more than one longhand). */
export function isShorthand(property: string): boolean {
  const canonical = canonicalName(property)
  return canonical === 'all' || canonical in SHORTHAND_LONGHANDS
}
