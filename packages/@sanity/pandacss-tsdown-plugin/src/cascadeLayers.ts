/**
 * One item of a CSS rule list as written: a statement (`@layer a, b;`, a declaration), or a
 * prelude followed by a `{…}` block, whose items are parsed the same way. Every character of the
 * source belongs to exactly one item, so serializing the items gives the source back.
 */
interface CssItem {
  /** The text up to the block, or the whole statement, leading whitespace and comments included. */
  prelude: string
  /** The items inside the block, or `undefined` for a statement. */
  block: CssItem[] | undefined
}

/**
 * A rule around rules of a layer, such as `@media print`, with the rules around it. It is created
 * once for the block it was written as, so the parts of the block that land next to each other in
 * the output can be put back in one block.
 */
interface Wrapper {
  prelude: string
  parent: Wrapper | undefined
}

/** An item that belongs to a layer, with the innermost rule it was written in, if any. */
interface LayerEntry {
  item: CssItem
  wrapper: Wrapper | undefined
}

/** A cascade layer: its sublayers in declaration order, and the items directly inside it. */
interface LayerNode {
  sublayers: Map<string | symbol, LayerNode>
  entries: LayerEntry[]
}

/** Matches the whitespace and comments an item starts with. */
const RE_LEADING_TRIVIA = /^(?:\s|\/\*[\s\S]*?(?:\*\/|$))*/
/** Matches the at-keyword an item starts with (after {@link RE_LEADING_TRIVIA}), as group 1. */
const RE_AT_KEYWORD = /^@([\w-]+)/
/** Matches a comment, to remove from a `@layer` prelude. */
const RE_COMMENT = /\/\*[\s\S]*?(?:\*\/|$)/g
/** Matches `url(` at `lastIndex`. */
const RE_URL_START = /url\(/iy
/**
 * Matches the start of a declaration whose value may hold a `{}` block, at `lastIndex`: a custom
 * property (`--rules: …`), or a property whose value is a block (`name: {…}`), the only other
 * declaration CSS parses with one. `a:hover {…}` is a nested rule.
 */
const RE_BLOCK_DECLARATION = /--[^\s:;{}]*\s*:|[\w-]+\s*:\s*\{/y
const RE_WHITESPACE = /\s/
/** Matches the hex digits of an escape, with the whitespace that may end it. */
const RE_HEX_ESCAPE = /^[0-9a-f]{1,6}\s?/i

/**
 * Removes every `@layer` block and statement from a stylesheet, ordering the rules so that source
 * order alone gives them the precedence the layers gave them: a layer's sublayers come in the
 * order they were first declared, before the rules directly inside the layer, which beat every
 * sublayer, and the rules outside any layer come last, since they beat every layer. Panda relies
 * on this for its `compositions` sublayer, which it emits after the utilities it has to lose to,
 * and it spreads the `recipes` layer over a `@layer recipes` and a `@layer recipes.slots` block.
 *
 * Source order is all a stylesheet without layers has, though: a more specific rule in an earlier
 * layer, which used to lose to a later layer, now wins, and `!important` declarations, whose layer
 * order is reversed, follow the same order as normal ones.
 *
 * A conditional rule (`@media print { @layer x { … } }`, likewise `@supports`, `@container` or a
 * style rule with nested rules) doesn't scope the layers in it, so its rules join the layers they
 * belong to, each part of it in a copy of the rule: layer order holds across its boundary.
 * Browsers only declare a layer in a conditional rule whose condition holds, though, so the order
 * of a layer first declared in one depends on the condition; here it is the order with every
 * condition holding. `@charset`, `@import` and `@namespace` statements stay ahead of the other
 * rules, where they have to be.
 *
 * It works on the text rather than on a lightningcss visitor, because a visitor hands the whole
 * stylesheet to JavaScript and back: that is many times slower than the native pass, changes how
 * some values print, and lightningcss 1.33 fails to read back any `var()` it serialized
 * (`expected an object-like struct named Specifier`). Every rule is copied verbatim, so the
 * lightningcss pass that follows sees Panda's rules as Panda wrote them.
 */
export function unwrapCascadeLayers(css: string): string {
  return serialize(unwrapItems(parseItems(css)))
}

function unwrapItems(items: CssItem[]): CssItem[] {
  const root: LayerNode = {sublayers: new Map(), entries: []}
  const leading: CssItem[] = []

  function collect(list: CssItem[], layer: LayerNode, wrapper: Wrapper | undefined): void {
    for (const item of list) {
      const keyword = atKeyword(item.prelude)
      if (keyword === 'layer') {
        const names = layerNames(item.prelude, item.block === undefined)
        if (item.block === undefined) {
          for (const name of names) resolveLayer(layer, name)
        } else {
          // Every anonymous `@layer { … }` block is a layer of its own
          const sublayer = resolveLayer(layer, names[0] ?? [Symbol('anonymous')])
          collect(item.block, sublayer, wrapper)
        }
      } else if (
        layer === root &&
        wrapper === undefined &&
        item.block === undefined &&
        (keyword === 'charset' || keyword === 'import' || keyword === 'namespace')
      ) {
        leading.push(item)
      } else if (item.block !== undefined && containsLayer(item.block)) {
        // The block's own formatting doesn't survive the split, only its rules do
        const rules = item.block.filter((child) => child.block !== undefined || !isTrivia(child))
        collect(rules, layer, {prelude: item.prelude, parent: wrapper})
      } else if (
        item.block === undefined &&
        !isTrivia(item) &&
        !item.prelude.trimEnd().endsWith(';')
      ) {
        // The last declaration of a block may leave out its `;`, which it needs next to others
        layer.entries.push({item: {prelude: `${item.prelude};`, block: undefined}, wrapper})
      } else {
        layer.entries.push({item, wrapper})
      }
    }
  }

  collect(items, root, undefined)
  return [...leading, ...rewrap(flattenLayer(root))]
}

/** The (sub)layer a layer name (`['recipes', 'slots']`) names, declared on first use. */
function resolveLayer(parent: LayerNode, name: readonly (string | symbol)[]): LayerNode {
  let node = parent
  for (const segment of name) {
    let sublayer = node.sublayers.get(segment)
    if (!sublayer) {
      sublayer = {sublayers: new Map(), entries: []}
      node.sublayers.set(segment, sublayer)
    }
    node = sublayer
  }
  return node
}

/** The entries of a layer and its sublayers, in the order of the layer's precedence. */
function flattenLayer(layer: LayerNode): LayerEntry[] {
  return [...[...layer.sublayers.values()].flatMap(flattenLayer), ...layer.entries]
}

/**
 * The items of a list of entries, in copies of the rules they were written in: consecutive
 * entries of one block share one copy of it.
 */
function rewrap(entries: readonly LayerEntry[]): CssItem[] {
  const items: CssItem[] = []
  /** The copies the previous entry went into, outermost first. */
  let open: {wrapper: Wrapper; block: CssItem[]}[] = []
  for (const {item, wrapper} of entries) {
    const wrappers: Wrapper[] = []
    for (let current = wrapper; current; current = current.parent) wrappers.unshift(current)
    let shared = 0
    while (shared < open.length && open[shared]?.wrapper === wrappers[shared]) shared++
    open = open.slice(0, shared)
    for (const next of wrappers.slice(shared)) {
      const block: CssItem[] = []
      ;(open.at(-1)?.block ?? items).push({prelude: next.prelude, block})
      open.push({wrapper: next, block})
    }
    ;(open.at(-1)?.block ?? items).push(item)
  }
  return items
}

/** Whether a block has a `@layer` rule in it, at any depth. */
function containsLayer(items: readonly CssItem[]): boolean {
  return items.some(
    (item) =>
      atKeyword(item.prelude) === 'layer' ||
      (item.block !== undefined && containsLayer(item.block)),
  )
}

function isTrivia(item: CssItem): boolean {
  return RE_LEADING_TRIVIA.exec(item.prelude)?.[0].length === item.prelude.length
}

function serialize(items: CssItem[]): string {
  let css = ''
  for (const item of items) {
    css += item.block ? `${item.prelude}{${serialize(item.block)}}` : item.prelude
  }
  return css
}

/** The lowercased name of the at-rule an item starts with, if it is one. */
function atKeyword(prelude: string): string | undefined {
  const start = RE_LEADING_TRIVIA.exec(prelude)?.[0].length ?? 0
  return RE_AT_KEYWORD.exec(prelude.slice(start))?.[1]?.toLowerCase()
}

/**
 * The layer names of a `@layer` rule's prelude, as identifier segments: the comma-separated list
 * of a statement, or the single (possibly missing) name of a block.
 */
function layerNames(prelude: string, isStatement: boolean): string[][] {
  let text = trimUnescaped(prelude.replace(RE_COMMENT, ' ')).replace(/^@layer/i, '')
  if (isStatement) text = text.replace(/;$/, '')
  return splitUnescaped(text, ',')
    .map((name) => splitUnescaped(trimUnescaped(name), '.').map(unescapeIdentifier))
    .filter((name) => name.length > 0 && name.every((segment) => segment.length > 0))
}

/** Trims whitespace, except an escaped one, which belongs to the identifier (`a\ `). */
function trimUnescaped(text: string): string {
  let end = text.length
  while (end > 0 && RE_WHITESPACE.test(text[end - 1] ?? '') && !isEscaped(text, end - 1)) end--
  return text.slice(0, end).trimStart()
}

/** Whether the character at `index` is escaped: preceded by an odd number of backslashes. */
function isEscaped(text: string, index: number): boolean {
  let backslashes = 0
  while (text[index - backslashes - 1] === '\\') backslashes++
  return backslashes % 2 === 1
}

function splitUnescaped(text: string, separator: string): string[] {
  if (!text) return []
  const parts: string[] = []
  let start = 0
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '\\') index++
    else if (text[index] === separator) {
      parts.push(text.slice(start, index))
      start = index + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

/** Resolves the escapes of a CSS identifier, so `u\-tokens` and `u-tokens` name the same layer. */
function unescapeIdentifier(identifier: string): string {
  let result = ''
  for (let index = 0; index < identifier.length; index++) {
    const char = identifier[index] ?? ''
    if (char !== '\\') {
      result += char
      continue
    }
    const hex = RE_HEX_ESCAPE.exec(identifier.slice(index + 1))
    if (hex) {
      const codePoint = Number.parseInt(hex[0], 16)
      const valid =
        codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff)
      result += valid ? String.fromCodePoint(codePoint) : '\ufffd'
      index += hex[0].length
    } else {
      result += identifier[index + 1] ?? ''
      index++
    }
  }
  return result
}

/**
 * Splits a rule list into items. Braces and semicolons only delimit items outside comments,
 * strings, escapes, unquoted `url()`s and parentheses or brackets, like in the CSS tokenizer. A
 * declaration whose value may hold a `{}` block is one statement, its value opaque: `@layer` in
 * a custom property's value is data, not a rule.
 */
function parseItems(css: string): CssItem[] {
  let index = 0

  function parseList(nested: boolean): CssItem[] {
    const items: CssItem[] = []
    let itemStart = index
    /** Whether the item has more than whitespace and comments so far. */
    let started = false
    let depth = 0
    while (index < css.length) {
      const char = css[index] ?? ''
      if (!started && depth === 0 && !RE_WHITESPACE.test(char) && !isCommentStart(css, index)) {
        started = true
        RE_BLOCK_DECLARATION.lastIndex = index
        if (RE_BLOCK_DECLARATION.test(css)) {
          index = skipDeclaration(css, index)
          items.push({prelude: css.slice(itemStart, index), block: undefined})
          itemStart = index
          started = false
          continue
        }
      }
      const skipped = skipToken(css, index)
      if (skipped !== undefined) {
        index = skipped
      } else if (char === '(' || char === '[') {
        depth++
        index++
      } else if ((char === ')' || char === ']') && depth > 0) {
        depth--
        index++
      } else if (depth === 0 && char === '{') {
        const prelude = css.slice(itemStart, index)
        index++
        const block = parseList(true)
        // `parseList` stops at the closing brace, or at the end of an unclosed block
        if (css[index] === '}') index++
        items.push({prelude, block})
        itemStart = index
        started = false
      } else if (depth === 0 && char === ';') {
        index++
        items.push({prelude: css.slice(itemStart, index), block: undefined})
        itemStart = index
        started = false
      } else if (depth === 0 && char === '}' && nested) {
        break
      } else {
        index++
      }
    }
    if (itemStart < index) items.push({prelude: css.slice(itemStart, index), block: undefined})
    return items
  }

  return parseList(false)
}

/**
 * The end of a declaration: after its `;`, or before the `}` that closes the block it is in.
 * Brackets and braces in its value are balanced, so a `{}` block in it belongs to the value.
 */
function skipDeclaration(css: string, start: number): number {
  let index = start
  let depth = 0
  while (index < css.length) {
    const char = css[index]
    const skipped = skipToken(css, index)
    if (skipped !== undefined) {
      index = skipped
    } else if (char === '(' || char === '[' || char === '{') {
      depth++
      index++
    } else if ((char === ')' || char === ']' || char === '}') && depth > 0) {
      depth--
      index++
    } else if (char === '}') {
      return index
    } else if (char === ';' && depth === 0) {
      return index + 1
    } else {
      index++
    }
  }
  return index
}

/** The end of the comment, string, escape or unquoted `url()` at `index`, if one starts there. */
function skipToken(css: string, index: number): number | undefined {
  const char = css[index]
  if (isCommentStart(css, index)) {
    const end = css.indexOf('*/', index + 2)
    return end === -1 ? css.length : end + 2
  }
  if (char === '"' || char === "'") return skipString(css, index)
  if (char === '\\') return index + 2
  if ((char === 'u' || char === 'U') && isUrlStart(css, index)) return skipUrl(css, index)
  return undefined
}

function isCommentStart(css: string, index: number): boolean {
  return css[index] === '/' && css[index + 1] === '*'
}

function skipString(css: string, start: number): number {
  const quote = css[start]
  let index = start + 1
  while (index < css.length) {
    const char = css[index]
    if (char === '\\') index += 2
    else if (char === quote) return index + 1
    // An unterminated string ends at the line break, like in the CSS tokenizer
    else if (char === '\n') return index
    else index++
  }
  return index
}

/** Whether an unquoted `url(` starts here: its contents may hold braces and semicolons. */
function isUrlStart(css: string, index: number): boolean {
  RE_URL_START.lastIndex = index
  if (!RE_URL_START.test(css)) return false
  const previous = css[index - 1]
  if (previous !== undefined && /[\w\\-]/.test(previous)) return false
  let next = index + 4
  while (next < css.length && /\s/.test(css[next] ?? '')) next++
  return css[next] !== '"' && css[next] !== "'"
}

function skipUrl(css: string, start: number): number {
  let index = start + 4
  while (index < css.length) {
    const char = css[index]
    if (char === '\\') index += 2
    else if (char === ')') return index + 1
    else index++
  }
  return index
}
