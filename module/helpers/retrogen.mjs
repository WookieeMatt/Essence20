/**
 * Retrogen (Cobra Codex, New Weapon Effects and Traits, p.92; granted by the Anti-V.E.N.O.M.
 * weapon upgrade): "grants ↑1 on attacks that target creatures with genetic Alterations."
 *
 * Nothing in the data marks an Alteration as Genetic or Cybernetic - RAW lets the character pick
 * the form when the Alteration is gained unless its source says otherwise. So the target counts
 * as having Genetic Alterations only when something on it says so plainly:
 *  - a Perk that only ever grants Genetic Alterations (Engrafted/Evolving/Outright Mutation), or
 *    requires them (Mutant), or Hypergenetic Manipulation; or
 *  - any item flagged `flags.essence20.geneticAlteration: true` - the escape hatch a GM can set
 *    on an Alteration a character chose to take in Genetic form.
 * When that finds something, the ↑1 is an automatic, labelled modifier in the Roll Options
 * Dialog. When it doesn't, a Retrogen weapon offers an off-by-default "Target has Genetic
 * Alterations" toggle instead, per the house rule that a per-roll judgement is a toggle.
 */
const COBRA_CODEX = "Compendium.essence20.cobra_codex.Item.";
export const ENGRAFTED_MUTATION_ID = `${COBRA_CODEX}zuR9YJ2Wy956VGGy`;
export const EVOLVING_MUTATION_ID = `${COBRA_CODEX}7cL4aUwJwqvbhYCz`;
export const OUTRIGHT_MUTATION_ID = `${COBRA_CODEX}RcGUjeMpsNDFjwmL`;
export const MUTANT_ID = `${COBRA_CODEX}j9v1B8yHJLKFbGrL`;
export const HYPERGENETIC_MANIPULATION_ID = "Compendium.essence20.ferocious_fighters.Item.qaTQqbLShvXZdKCp";

export const GENETIC_ALTERATION_SOURCE_IDS = [
  ENGRAFTED_MUTATION_ID, EVOLVING_MUTATION_ID, OUTRIGHT_MUTATION_ID, MUTANT_ID, HYPERGENETIC_MANIPULATION_ID,
];

/**
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function isRetrogenWeapon(weapon) {
  return !!weapon?.system?.traits?.includes('retrogen');
}

/**
 * Whether anything on this actor clearly marks it as having Genetic Alterations - see this
 * file's own doc comment.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasGeneticAlterations(actor) {
  return !!actor?.items?.some(item => {
    if (item.flags?.essence20?.geneticAlteration === true) {
      return true;
    }

    const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
    return !!sourceId && GENETIC_ALTERATION_SOURCE_IDS.includes(sourceId);
  });
}
