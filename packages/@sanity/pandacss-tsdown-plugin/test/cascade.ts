import {
  transform,
  type Declaration,
  type Rule,
  type Selector,
  type SelectorComponent,
} from 'lightningcss'

/**
 * An element without ancestors, for {@link cascadeWinner}. Panda's conditions in the tests'
 * fixture also match a data attribute (`&:is(:hover, [data-hover])`), which stands in for the
 * user action: the element is never hovered or focused itself.
 */
export interface CascadeElement {
  tag: string
  classes?: readonly string[]
  attributes?: Readonly<Record<string, string>>
}

interface Candidate {
  label: string
  selector: string
  layer: LayerNode
  specificity: [number, number, number]
}

/** A cascade layer: its sublayers in declaration order, and its rank once they are ranked. */
interface LayerNode {
  sublayers: Map<string, LayerNode>
  rank: number
}

/**
 * The rule whose declaration of `property` the cascade applies to an element, as
 * `"<stylesheet label>: <selector>"`, from stylesheets loaded in the given order — or
 * `undefined` when none declares it. It models the parts of the cascade the tests are about, for
 * normal declarations: rules outside layers beat layered ones, later layers beat earlier ones,
 * and a layer's own rules beat its sublayers; then specificity, then source order. Rules in
 * conditional rules (`@media`, `@supports`) don't apply, and a selector with a combinator or a
 * pseudo-element never matches.
 */
export function cascadeWinner(
  stylesheets: readonly (readonly [label: string, css: string])[],
  element: CascadeElement,
  property: string,
): string | undefined {
  const root: LayerNode = {sublayers: new Map(), rank: 0}
  let anonymousLayers = 0
  const candidates: Candidate[] = []

  for (const [label, css] of stylesheets) {
    const lineStarts = [0]
    for (let index = css.indexOf('\n'); index !== -1; index = css.indexOf('\n', index + 1)) {
      lineStarts.push(index + 1)
    }

    const collect = (rules: Rule[], layer: LayerNode): void => {
      for (const rule of rules) {
        if (rule.type === 'layer-statement') {
          for (const name of rule.value.names) resolveLayer(layer, name)
        } else if (rule.type === 'layer-block') {
          // Every anonymous `@layer { … }` block is a layer of its own
          const name = rule.value.name ?? [`\0anonymous-${anonymousLayers++}`]
          collect(rule.value.rules, resolveLayer(layer, name))
        } else if (rule.type === 'style') {
          const declarations = rule.value.declarations?.declarations ?? []
          if (!declarations.some((declaration) => propertyName(declaration) === property)) continue
          const matching = rule.value.selectors.filter((selector) => matches(selector, element))
          if (matching.length === 0) continue
          const {line, column} = rule.value.loc
          const start = (lineStarts[line] ?? 0) + column - 1
          candidates.push({
            label,
            selector: css.slice(start, css.indexOf('{', start)).trim(),
            layer,
            specificity: matching
              .map(specificity)
              .reduce((max, next) => (compareSpecificity(next, max) > 0 ? next : max)),
          })
        }
      }
    }

    transform({
      filename: `${label}.css`,
      code: new TextEncoder().encode(css),
      visitor: {
        // Read-only: the stylesheet is walked here, with the layers its rules are in
        StyleSheet(stylesheet) {
          collect(stylesheet.rules, root)
        },
      },
    })
  }

  // A layer's own rules beat its sublayers, which rank in declaration order; unlayered rules,
  // the root's own, beat every layer
  let rank = 0
  const rankLayers = (layer: LayerNode): void => {
    for (const sublayer of layer.sublayers.values()) rankLayers(sublayer)
    layer.rank = rank++
  }
  rankLayers(root)

  let winner: Candidate | undefined
  for (const candidate of candidates) {
    if (
      !winner ||
      candidate.layer.rank > winner.layer.rank ||
      (candidate.layer.rank === winner.layer.rank &&
        compareSpecificity(candidate.specificity, winner.specificity) >= 0)
    ) {
      winner = candidate
    }
  }
  return winner && `${winner.label}: ${winner.selector}`
}

/**
 * The selector and declaration lines of a pretty-printed stylesheet, trimmed and sorted: what it
 * says, regardless of layers, order and indentation.
 */
export function ruleLines(css: string): string[] {
  return css
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && line !== '}' && !line.startsWith('@layer'))
    .toSorted()
}

function resolveLayer(parent: LayerNode, name: readonly string[]): LayerNode {
  let node = parent
  for (const segment of name) {
    let sublayer = node.sublayers.get(segment)
    if (!sublayer) {
      sublayer = {sublayers: new Map(), rank: 0}
      node.sublayers.set(segment, sublayer)
    }
    node = sublayer
  }
  return node
}

function propertyName(declaration: Declaration): string {
  if (declaration.property === 'unparsed') return declaration.value.propertyId.property
  if (declaration.property === 'custom') return declaration.value.name
  return declaration.property
}

function matches(selector: Selector, element: CascadeElement): boolean {
  return selector.every((component) => matchesComponent(component, element))
}

function matchesComponent(component: SelectorComponent, element: CascadeElement): boolean {
  switch (component.type) {
    case 'type':
      return component.name === element.tag
    case 'class':
      return element.classes?.includes(component.name) ?? false
    case 'attribute': {
      const value = element.attributes?.[component.name]
      if (value === undefined) return false
      return !component.operation || value === component.operation.value
    }
    case 'pseudo-class':
      if (component.kind === 'is' || component.kind === 'where' || component.kind === 'any') {
        return component.selectors.some((selector) => matches(selector, element))
      }
      if (component.kind === 'not') {
        return !component.selectors.some((selector) => matches(selector, element))
      }
      return false
    case 'universal':
    case 'namespace':
      return true
    case 'id':
    case 'combinator':
    case 'pseudo-element':
    case 'nesting':
      return false
    default: {
      const unknownComponent: never = component
      return unknownComponent
    }
  }
}

function specificity(selector: Selector): [number, number, number] {
  const result: [number, number, number] = [0, 0, 0]
  for (const component of selector) {
    if (component.type === 'id') result[0]++
    else if (component.type === 'class' || component.type === 'attribute') result[1]++
    else if (component.type === 'type' || component.type === 'pseudo-element') result[2]++
    else if (component.type === 'pseudo-class') {
      if (component.kind === 'where') continue
      if (component.kind === 'is' || component.kind === 'not' || component.kind === 'any') {
        const [a, b, c] = component.selectors
          .map(specificity)
          .reduce((max, next) => (compareSpecificity(next, max) > 0 ? next : max))
        result[0] += a
        result[1] += b
        result[2] += c
      } else {
        result[1]++
      }
    }
  }
  return result
}

function compareSpecificity(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}
