/**
 * Ported from `@vanilla-extract/css` (MIT licensed, Copyright (c) 2021 SEEK):
 * `packages/css/src/conditionalRulesets.ts`, with the untyped rule bodies typed.
 */

/** e.g. @media screen and (min-width: 500px) */
type Query = string

export interface ConditionalRule {
  selector: string
  rule: Record<string, unknown>
}

export interface Condition {
  query: Query
  rules: Array<ConditionalRule>
  children: ConditionalRuleset
}

/** `{[query]: {[selector]: declarations | nested query}}`, as consumed by `renderCss`. */
export type RenderedConditionalRule = Record<string, Record<string, unknown>>

export class ConditionalRuleset {
  ruleset: Map<Query, Condition>

  /**
   * Stores information about where conditions must be in relation to other conditions
   *
   * e.g. mobile -> tablet, desktop
   */
  precedenceLookup: Map<Query, Set<string>>

  constructor() {
    this.ruleset = new Map()
    this.precedenceLookup = new Map()
  }

  findOrCreateCondition(conditionQuery: Query): Condition {
    let targetCondition = this.ruleset.get(conditionQuery)

    if (!targetCondition) {
      // No target condition so create one
      targetCondition = {
        query: conditionQuery,
        rules: [],
        children: new ConditionalRuleset(),
      }
      this.ruleset.set(conditionQuery, targetCondition)
    }

    return targetCondition
  }

  getConditionalRulesetByPath(conditionPath: ReadonlyArray<Query>): ConditionalRuleset {
    // Couldn't find a way around this
    // oxlint-disable-next-line typescript/no-this-alias
    let currRuleset: ConditionalRuleset = this

    for (const query of conditionPath) {
      const condition = currRuleset.findOrCreateCondition(query)

      currRuleset = condition.children
    }

    return currRuleset
  }

  addRule(rule: ConditionalRule, conditionQuery: Query, conditionPath: ReadonlyArray<Query>): void {
    const ruleset = this.getConditionalRulesetByPath(conditionPath)
    const targetCondition = ruleset.findOrCreateCondition(conditionQuery)

    targetCondition.rules.push(rule)
  }

  addConditionPrecedence(
    conditionPath: ReadonlyArray<Query>,
    conditionOrder: ReadonlyArray<Query>,
  ): void {
    const ruleset = this.getConditionalRulesetByPath(conditionPath)

    for (let i = 0; i < conditionOrder.length; i++) {
      const query = conditionOrder[i]

      if (query === undefined) {
        continue
      }

      const conditionPrecedence = ruleset.precedenceLookup.get(query) ?? new Set<string>()

      for (const lowerPrecedenceCondition of conditionOrder.slice(i + 1)) {
        conditionPrecedence.add(lowerPrecedenceCondition)
      }

      ruleset.precedenceLookup.set(query, conditionPrecedence)
    }
  }

  isCompatible(incomingRuleset: ConditionalRuleset): boolean {
    for (const [condition, orderPrecedence] of this.precedenceLookup.entries()) {
      for (const lowerPrecedenceCondition of orderPrecedence) {
        if (incomingRuleset.precedenceLookup.get(lowerPrecedenceCondition)?.has(condition)) {
          return false
        }
      }
    }

    // Check that children are compatible
    for (const {query, children} of incomingRuleset.ruleset.values()) {
      const matchingCondition = this.ruleset.get(query)

      if (matchingCondition && !matchingCondition.children.isCompatible(children)) {
        return false
      }
    }

    return true
  }

  merge(incomingRuleset: ConditionalRuleset): void {
    // Merge rulesets into one array
    for (const {query, rules, children} of incomingRuleset.ruleset.values()) {
      const matchingCondition = this.ruleset.get(query)

      if (matchingCondition) {
        matchingCondition.rules.push(...rules)

        matchingCondition.children.merge(children)
      } else {
        this.ruleset.set(query, {query, rules, children})
      }
    }

    // Merge order precedences
    for (const [condition, incomingOrderPrecedence] of incomingRuleset.precedenceLookup.entries()) {
      const orderPrecedence = this.precedenceLookup.get(condition) ?? new Set<string>()

      this.precedenceLookup.set(
        condition,
        new Set([...orderPrecedence, ...incomingOrderPrecedence]),
      )
    }
  }

  /**
   * Merge another ConditionalRuleset into this one if they are compatible
   *
   * @returns true if successful, false if the ruleset is incompatible
   */
  mergeIfCompatible(incomingRuleset: ConditionalRuleset): boolean {
    if (!this.isCompatible(incomingRuleset)) {
      return false
    }

    this.merge(incomingRuleset)

    return true
  }

  getSortedRuleset(): Condition[] {
    const sortedRuleset: Array<Condition> = []

    // Loop through all queries and add them to the sorted ruleset
    for (const [query, dependents] of this.precedenceLookup.entries()) {
      const conditionForQuery = this.ruleset.get(query)

      if (!conditionForQuery) {
        throw new Error(`Can't find condition for ${query}`)
      }

      // Find the location of the first dependent condition in the sortedRuleset
      // A dependent condition is a condition that must be placed *after* the current one
      const firstMatchingDependent = sortedRuleset.findIndex((condition) =>
        dependents.has(condition.query),
      )

      if (firstMatchingDependent > -1) {
        // Insert the condition before the dependent one
        sortedRuleset.splice(firstMatchingDependent, 0, conditionForQuery)
      } else {
        // No match, just insert at the end
        sortedRuleset.push(conditionForQuery)
      }
    }

    return sortedRuleset
  }

  renderToArray(): RenderedConditionalRule[] {
    const arr: RenderedConditionalRule[] = []

    for (const {query, rules, children} of this.getSortedRuleset()) {
      const selectors: Record<string, unknown> = {}

      for (const rule of rules) {
        const existing = selectors[rule.selector]
        selectors[rule.selector] = {
          // Preserve existing declarations if a rule with the same selector has already been added
          ...(typeof existing === 'object' && existing !== null ? existing : {}),
          ...rule.rule,
        }
      }

      Object.assign(selectors, ...children.renderToArray())

      arr.push({[query]: selectors})
    }

    return arr
  }
}
