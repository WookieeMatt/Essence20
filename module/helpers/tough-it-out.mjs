import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";
import { computeRestoreHealthDif, pickHealSkillTestAmount } from "./heal-skill-test.mjs";

/**
 * Tough It Out (Transformers CRB, Focus: Warrior, 5th level, p.91): "At 5th level, once per
 * Combat, you can make a Brawn Skill Test to Repair your damage as a Standard action. The DIF is
 * the same as the Technology Skill Test to Repair damage."
 *
 * Same helpers/heal-skill-test.mjs primitive as Patch Up/Preventative Measures - a player-chosen
 * amount driving RAW's own DIF = 5 + 5*amount formula (see that module's own doc comment) - but
 * self-only, rolled with Brawn instead of Technology, and gated once per Combat rather than once
 * per turn or per Energon. "Once per Combat" is modeled as this codebase's existing once-per-
 * encounter tracker (helpers/perks.mjs#hasUsedThisEncounter), the same window Didn't Even Feel It's
 * own "once per encounter" already uses.
 */
export const TOUGH_IT_OUT_ID = "Compendium.essence20.tf_crb.Item.B6b8dRybHodMv8aC";
const TOUGH_IT_OUT_ENCOUNTER_FLAG = 'toughItOutUsedThisEncounter';
const MAX_AMOUNT = 6;

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseToughItOut(actor) {
  return !hasUsedThisEncounter(actor, TOUGH_IT_OUT_ENCOUNTER_FLAG);
}

/**
 * Prompts for a Health amount, marks the encounter used, and triggers a real Brawn Skill Test
 * against RAW's own DIF formula, targeting the actor themselves.
 * @param {Actor} actor
 */
export async function activateToughItOut(actor) {
  if (!canUseToughItOut(actor)) {
    ui.notifications.warn(game.i18n.localize('E20.ToughItOutUnavailable'));
    return;
  }

  const amount = await pickHealSkillTestAmount(MAX_AMOUNT);
  if (!amount) {
    return;
  }

  await markUsedThisEncounter(actor, TOUGH_IT_OUT_ENCOUNTER_FLAG);

  const dif = computeRestoreHealthDif(amount);
  await actor._dice.rollSkill({
    skill: 'brawn', essence: 'strength', dif: String(dif), isToughItOut: true, toughItOutAmount: amount,
  }, actor);
}
