/**
 * Painmonger (Decepticon Directive, Inquisitor Focus, 3rd level, p.43): "At 3rd level, you know
 * how to inflict physical anguish in a multitude of different ways. Any of your attacks or game
 * effects that inflict Stun also impose the Impaired Condition on a target until the end of the
 * target's next turn."
 *
 * A passive, always-on rider rather than a Use-button - checked directly in dice.mjs's own per-
 * target results.map() (the `painmongerImpaired` field, next to `frightened`/`explosiveAftershock`
 * above it), approximated as this attack's own PRIMARY damage type being Stun (item.system.
 * damageType == 'stun') rather than exhaustively covering every possible secondary/synthetic Stun
 * source in this codebase (secondaryDamage, Menace's own stun rider, etc.) - the same scoped-
 * approximation idiom this project already accepts elsewhere for a broad "any... effects" clause.
 * "Until the end of the target's next turn" is approximated as a 1-round Condition via
 * helpers/timed-status.mjs#applyTimedCondition, this project's own standard duration idiom.
 */
export const PAINMONGER_ID = "Compendium.essence20.decepticon_directive.Item.6lQNn6RY1Kclydw8";
