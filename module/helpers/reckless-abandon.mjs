import { actorHasPerk } from "./perks.mjs";

/**
 * GI Joe CRB p.94 - the Renegade Role's signature Reckless Abandon Role Points Item:
 * "While acting with Reckless Abandon, you gain the following benefits as long as you are
 * wearing light armor or no armor: You gain Upshift 2 on all Strength Skill Tests. You gain
 * Bonus Health as shown on the Role chart."
 *
 * The Bonus Health half, the per-day Uses resource pool, and the Active/Activatable toggle
 * itself are ALL already fully generic - Reckless Abandon is an ordinary `healthBonus` Role
 * Points Item (isActivatable: true), and documents/actor.mjs's own _prepareHealth() already
 * folds an active healthBonus grant's per-level value into health.max, exactly the same way
 * defenseBonus Role Points already worked before Personal Shield's own "already built" correction
 * this session. Only the conditional Strength Skill Test upshift below needed new code - nothing
 * generic reads "this Essence, while this specific Role Points item is Active, gated on armor."
 *
 * Correction: this used to add the bonus as a flat +2 to the roll's numeric modifier instead of
 * 2 upshifts - the PDF's own up-shift glyph is lost by plain-text extraction (renders as blank
 * space before the number), the same misreading a live bug report already caught once for
 * Expertise's own "gaining [up-shift]2" text. Fixed to apply via shiftUp instead, matching
 * Beast of Burden/Alert/Silent Weapon Expertise's own (already-correct) shape.
 */

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const RECKLESS_ABANDON_ID = `${GI_JOE_CRB}84d0XTJwKCYMJUgY`;
// Hardened (Tank Focus, 1st level): "You are trained in Medium armor, and can fight with Reckless
// Abandon while in Medium armor" - extends the armor gate below from light-or-no-armor to also
// allow Medium for actors with this Perk.
const HARDENED_ID = `${GI_JOE_CRB}f7d5bkyxVpbR4dAe`;

/**
 * Whether the given Role Points Item is GI Joe's own Reckless Abandon grant specifically (not just
 * any healthBonus Role Points Item) - a plain sourceId check, independent of its current isActive
 * state. Exported for Aegis's own deactivation check in base-actor-sheet.mjs, which needs to know
 * WHICH item was just clicked before the click's own isActive flip is written (isRecklessAbandonActive
 * below would read the state that's about to become stale).
 * @param {Item} rolePoints
 * @returns {Boolean}
 */
export function isRecklessAbandonItem(rolePoints) {
  if (!rolePoints) {
    return false;
  }

  const sourceId = rolePoints.flags?.core?.sourceId ?? rolePoints._stats?.compendiumSource;
  return sourceId == RECKLESS_ABANDON_ID;
}

/**
 * Whether the given actor's base Role Points Item is specifically GI Joe's Reckless Abandon grant
 * (not just any healthBonus Role Points Item - Power Rangers/My Little Pony have their own), and
 * it's currently switched on via the sheet's existing Active toggle.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isRecklessAbandonActive(actor) {
  const rolePoints = actor._getBaseRolePoints?.();
  return isRecklessAbandonItem(rolePoints) && !!rolePoints.system.isActive;
}

/**
 * The Strength Skill Test upshift (2) from an active Reckless Abandon, or 0 when inactive or when
 * the actor is wearing armor heavier than the rule allows (Medium armor is still allowed with
 * Hardened, Heavy/Ultra Heavy never qualify).
 * @param {Actor} actor
 * @returns {Number}
 */
export function getRecklessAbandonStrengthShiftUp(actor) {
  if (!isRecklessAbandonActive(actor)) {
    return 0;
  }

  const equippedArmor = (actor.items?.documentsByType?.armor ?? []).filter(a => a.system.equipped);
  const hasHardened = actorHasPerk(actor, HARDENED_ID);
  const armorBlocksIt = equippedArmor.some(a => {
    const classification = a.system.classification;
    return classification == 'heavy' || classification == 'ultraHeavy'
      || (classification == 'medium' && !hasHardened);
  });

  return armorBlocksIt ? 0 : 2;
}

// Aegis (Tank Focus, 20th level, p.99): "While fighting with Reckless Abandon, having 0 Health
// doesn't cause you to be Defeated, and you are only defeated if you still have 0 Health at the
// end of your Reckless Abandon." Two parts:
// - AEGIS_CLAMPED_FLAG marks that a hit was about to reduce the actor to 0 Health while Reckless
//   Abandon was active and Aegis held - see its own consumption in helpers/combat.mjs#applyDamage
//   (the same "clamp newValue at 1 instead of 0" shape Immortal Rebel Soul/Defender's Oath already
//   establish), set here so the deactivation check below knows to look.
// - applyAegisDefeatCheck runs from base-actor-sheet.mjs's own Reckless Abandon Activate/Deactivate
//   click (the same interception point Protector's Shield's own Temporary Health grant already
//   hooks), right as it's being switched OFF - if the actor is still at the clamped Health (1, this
//   codebase's floor) and the flag is set, Aegis's own protection has run out and the real Defeat
//   finally lands.
const AEGIS_ID = `${GI_JOE_CRB}0ZTjZ36gN74889am`;
export const AEGIS_CLAMPED_FLAG = 'aegisClamped';

/**
 * Called when Reckless Abandon is switched OFF - applies Aegis's own deferred Defeat check.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function applyAegisDefeatCheck(actor) {
  if (!actorHasPerk(actor, AEGIS_ID) || !actor.getFlag?.('essence20', AEGIS_CLAMPED_FLAG)) {
    return;
  }

  await actor.unsetFlag('essence20', AEGIS_CLAMPED_FLAG);
  if (actor.system.health.value <= 1) {
    await actor.toggleStatusEffect('defeated', { active: true });
  }
}
