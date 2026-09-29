import { actorHasPerk } from "../../perks.mjs";

/**
 * The few gij3 rules that have to sit inside the roll itself, called from dice.mjs and
 * helpers/rough-terrain.mjs (SCRATCH/integration/gij3-patch.cjs adds the calls). Kept synchronous
 * and light - this file imports nothing heavier than perks.mjs, so dice.mjs can import it at the top.
 */

const GIJ_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const HAWK = "Compendium.essence20.general_hawk_s_personel_files.Item.";

export const SECONDS_BETWEEN_CLICK_AND_BOOM_ID = `${GIJ_CRB}ofiG5IwlURUwORYV`;
export const BETTER_THAN_THE_BEST_ID = `${HAWK}1Xy3GpglIFAq3sqc`;
export const TAKEDOWN_EXPERT_ID = `${GIJ_CRB}gO9IixdCX0fhReZk`;

function resolveActor(actorOrUuid) {
  if (!actorOrUuid) {
    return null;
  }

  if (typeof actorOrUuid != 'string') {
    return actorOrUuid;
  }

  try {
    const doc = fromUuidSync(actorOrUuid);
    return doc?.documentName == 'Token' ? doc.actor : (doc ?? null);
  } catch (error) {
    return null;
  }
}

/**
 * Better than the Best (Hawk's Personnel Files, Old Hand, 10th level, p.165): "when you roll a 20
 * on the d20 during a Skill Test, you succeed at the Skill Test. If you would already succeed at
 * the Skill Test normally, it is considered a Critical Success." Read off the kept d20 (the one
 * an Edge/Snag keeps - Foundry's `values` are the active results only).
 * @param {Actor} actor   The roller.
 * @param {Roll} roll
 * @param {Number} multiplier   This entry's Degrees of Success so far (0 miss, 1 success, 2+ crit).
 * @returns {Number}   The new multiplier.
 */
export function betterThanTheBestMultiplier(actor, roll, multiplier) {
  if (!actorHasPerk(actor, BETTER_THAN_THE_BEST_ID)) {
    return multiplier;
  }

  const d20 = (roll?.dice ?? []).find(pool => pool.faces === 20);
  const values = d20?.values ?? (d20?.results ?? []).filter(r => r.active !== false).map(r => r.result);
  if (!values?.includes?.(20)) {
    return multiplier;
  }

  return multiplier > 0 ? Math.max(multiplier, 2) : 1;
}

/**
 * Seconds Between Click & Boom (GI Joe CRB, Commando, 9th level, p.71): "attacks against your
 * Evasion Defense suffer a Snag. If your attacker misses, you suffer no effects (even if there
 * would be an effect on a miss)." The Snag half is in dice.mjs; this is the second sentence - the
 * miss-effects this system applies (Trigger Happy's Frightened, Explosive Aftershock, a Wrecker
 * weapon's Rough Terrain) are skipped for the holder.
 * @param {String} defenseType   The Defense the attack was compared against.
 * @param {Actor|String} target   The defender, or its uuid.
 * @returns {Boolean}   True when a miss must have no effect at all on this target.
 */
export function ignoresMissEffects(target, defenseType = 'evasion') {
  if (defenseType != 'evasion') {
    return false;
  }

  const actor = resolveActor(target);
  return !!actor && actorHasPerk(actor, SECONDS_BETWEEN_CLICK_AND_BOOM_ID);
}

/**
 * Takedown Expert (GI Joe CRB, Infiltrator, 6th level, p.73): "If you fail against a target of a
 * threat level no higher than your level, in addition to being grappled, you may choose if your
 * target is additionally disarmed, immobilized, or silenced." dice.mjs calls this in place of its
 * old always-Immobilized line. Disarmed goes through target-riders.mjs#disarm (the held weapon is
 * knocked loose); Silenced is the 'silenced' status gij3.mjs adds.
 * @param {Actor} actor   The one attempting the Takedown.
 * @param {Actor} target
 * @returns {Promise<String|null>}   What was chosen.
 */
export async function takedownExpertChoice(actor, target) {
  if (!actorHasPerk(actor, TAKEDOWN_EXPERT_ID) || !target) {
    return null;
  }

  const T = key => game.i18n.localize(`E20.${key}`);
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: T('Gij3TakedownExpert') },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.format('E20.Gij3TakedownExpertPrompt', { name: target.name })}</p>`,
    buttons: [
      { action: 'disarmed', label: T('Gij3TakedownDisarmed') },
      { action: 'immobilized', label: T('Gij3TakedownImmobilized'), default: true },
      { action: 'silenced', label: T('Gij3TakedownSilenced') },
    ],
    rejectClose: false,
  });

  if (choice == 'disarmed') {
    const { disarm } = await import("../../target-riders.mjs");
    await disarm(actor, target, { maxHands: 2, source: T('Gij3TakedownExpert') });
  } else if (choice == 'immobilized' || choice == 'silenced') {
    await target.toggleStatusEffect(choice, { active: true });
  }

  if (choice) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: game.i18n.format('E20.Gij3TakedownExpertChat', { name: actor.name, target: target.name, what: T(`Gij3Takedown${choice.charAt(0).toUpperCase()}${choice.slice(1)}`) }),
    });
  }

  return choice ?? null;
}
