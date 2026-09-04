import { actorHasPerk } from "./perks.mjs";

/**
 * Shaped Charges (Artillery Focus, 7th level, p.81): "when you attack with an explosive, you may
 * first roll the skill die you use for the attack and exclude that number of targets in the area
 * of effect." (Its other clause - double damage to objects and structures - has no mechanical
 * hook: this system has no "object"/"structure" actor type to compare against, the same kind of
 * gap as Plate Piercing's own unautomated Armor Piercing clause, combat.mjs.) Runs right after
 * placeAoeTemplate catches its tokens and before Horseshoes and Handgrenades' own flat-damage tax
 * (item.mjs's own roll() wiring), since an excluded target should dodge BOTH that tax and the
 * attack roll itself, not just the roll.
 *
 * The book leaves "which targets" entirely up to the attacker once the roll sets a maximum count
 * - not a hard mechanical cap this file enforces (same "fictional limit, not a hard block"
 * precedent as Multiple Targets' own X, dice.mjs#_isMultipleTargetsAttack), just guidance text in
 * the prompt itself.
 */
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
export const SHAPED_CHARGES_ID = `${GI_JOE_CRB}xFMzM5pycDmmw4u3`;

/**
 * Rolls the attacker's current skill die (e.g. 'd8', '2d8') for the weaponEffect's own attack
 * skill, then lets the attacker check off up to that many of the caught tokens to exclude. Only
 * ever prompts with an actual choice to make - a Perk-less/non-explosive attack, an empty catch,
 * or a non-rollable shift (criticalSuccess/autoSuccess, too high to have an actual die) all just
 * pass tokens through unchanged.
 * @param {Actor} actor   The attacker.
 * @param {Item} item   The weaponEffect being rolled.
 * @param {Array<Token>} tokens   Tokens the AoE shape caught (see aoe-targeting.mjs).
 * @returns {Promise<Array<Token>>}   The tokens that remain after exclusion (a new array, also
 *   re-targeted via canvas.tokens.setTargets so the eventual attack roll's own
 *   Array.from(game.user.targets) - dice.mjs#rollSkill - agrees with what's returned here).
 */
export async function applyShapedCharges(actor, item, tokens) {
  const isExplosiveAttack = item?.type == 'weaponEffect' && item.system.classification?.style == 'explosive';
  if (!isExplosiveAttack || !tokens.length || !actorHasPerk(actor, SHAPED_CHARGES_ID)) {
    return tokens;
  }

  const shift = actor.system.skills[item.system.classification.skill]?.shift;
  if (!shift || !/^\d*d\d+$/.test(shift)) {
    return tokens;
  }

  const dieRoll = await new Roll(shift).evaluate();
  const excludeCount = dieRoll.total;

  const checkboxes = tokens.map(token =>
    `<div class="form-group"><label><input type="checkbox" name="${token.id}"> ${token.name}</label></div>`,
  ).join('');
  const chosenIds = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ShapedChargesPickTitle') },
    classes: ["window-app"],
    content: `<p>${game.i18n.format('E20.ShapedChargesPickLabel', { count: excludeCount })}</p>${checkboxes}`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => tokens
          .filter(token => button.form.elements[token.id]?.checked)
          .map(token => token.id),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel', callback: () => [] },
    ],
  });

  const excludedIds = new Set(Array.isArray(chosenIds) ? chosenIds : []);
  if (!excludedIds.size) {
    return tokens;
  }

  const remaining = tokens.filter(token => !excludedIds.has(token.id));
  canvas.tokens.setTargets(remaining.map(token => token.id));
  return remaining;
}
