import { isMechanical } from "../../mechanics/characters/creature-tags.mjs";
import { ruleCoatingCost, ruleKeepsVialOnFumble } from "../../rules/plugins/resources/poison-coating-rule.mjs";

/**
 * Poisons put on weapons, and changing what a poison is (Cobra Codex, p.92-97).
 *
 * Applying a contact poison to a weapon or one round of ammunition is a Standard action and a Science
 * test against the poison's Availability DIF (p.93, Table 3-1): a Critical Success applies it without
 * using the vial up, a success applies it and uses the vial, a failure does nothing, a Fumble wastes
 * the vial. Once applied, the next hit with the weapon adds the poison's effect to the weapon's own.
 *
 * The coating is a flag on the weapon holding the poison's effect, so the vial can be used up and
 * the coating still knows what it does. The next attack with the weapon wipes it; a hit also offers
 * the poison's effect as a second button on the card (target-riders.mjs#applyRollRiders).
 *
 * - Poisonous, Intoxicate (a cheaper action) and Poison Tipped (a Fumble keeps the vial) are their items' own
 *   PoisonCoating rules (rules/plugins/resources/poison-coating-rule.mjs).
 * - Poison Chemistry (6th level, p.49): a Standard action switches a poison in hand between
 *   contact, ingested and inhaled.
 * - Poison Prodigy (20th level, p.50): a Standard action turns a poison in hand into any other, even
 *   a harder-to-get one; a Move action adds a weapon upgrade to it if it qualifies.
 * - Hacker (General Perk, p.80): each requisitioned poison is either ordinary or a hacker poison
 *   that only affects robots and Computerized targets. A hacker poison is marked on the poison itself.
 */

const COATING_FLAG = 'poisonCoating';
export const HACKER_POISON_FLAG = 'hackerPoison';

export function poisonsOf(actor) {
  return (actor?.items?.contents ?? [...(actor?.items ?? [])]).filter(item => item.type == 'weapon' && item.system?.isPoison);
}

function effectsOf(actor, weapon) {
  return (actor?.items?.contents ?? [...(actor?.items ?? [])])
    .filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id);
}

/**
 * What applying a contact poison costs this actor: a Standard action, or what its PoisonCoating rules make it.
 */
export function coatingCost(actor) {
  return ruleCoatingCost(actor) ?? 'standard';
}

/**
 * The poison on this weapon, if any.
 * @param {Item} weapon
 * @returns {{name: String, damageValue: Number, damageType: String, hacker: Boolean}|null}
 */
export function coatingOf(weapon) {
  return weapon?.flags?.essence20?.[COATING_FLAG] ?? null;
}

export function isHackerPoison(item) {
  return !!item?.flags?.essence20?.[HACKER_POISON_FLAG];
}

/**
 * A hacker poison only works on robots and computerized targets.
 * @param {Item} poison   The poison (or a coating snapshot with `hacker`).
 * @param {Actor} target
 */
export function poisonAffects(poison, target) {
  const hacker = poison?.hacker ?? isHackerPoison(poison);
  return !hacker || isMechanical(target);
}

async function pick(title, label, options) {
  if (!options.length) {
    return null;
  }

  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${label}</label><select name="choice">${
      options.map(o => `<option value="${o.value}">${foundry.utils.escapeHTML(o.label)}</option>`).join('')
    }</select></div>`,
    buttons: [
      { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => button.form.elements.choice.value },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  }).then(result => (result && result != 'cancel' ? result : null));
}

/**
 * Apply a contact poison to a weapon: pick both, pay the action, roll Science against the poison's
 * Availability DIF. dice.mjs hands the roll back to resolveCoatingRoll.
 * @param {Actor} actor
 * @param {Object} economy   mechanics/actions/action-economy.mjs, passed in to keep this file free of it.
 * @returns {Promise<String|null>}   A chat line, or null.
 */
export async function startCoating(actor, economy) {
  const poisons = poisonsOf(actor).filter(p => p.system.poisonApplication?.contact && (p.system.quantity ?? 1) > 0);
  const weapons = (actor.items.contents ?? [...actor.items]).filter(i => i.type == 'weapon' && !i.system?.isPoison);
  if (!poisons.length || !weapons.length) {
    ui.notifications.warn(game.i18n.localize('E20.PoisonCoatNothing'));
    return null;
  }

  const poisonId = await pick(game.i18n.localize('E20.PoisonCoatTitle'), game.i18n.localize('E20.PoisonCoatPickPoison'),
    poisons.map(p => ({ value: p.id, label: p.name })));
  if (!poisonId) {
    return null;
  }

  const weaponId = await pick(game.i18n.localize('E20.PoisonCoatTitle'), game.i18n.localize('E20.PoisonCoatPickWeapon'),
    weapons.map(w => ({ value: w.id, label: w.name })));
  if (!weaponId) {
    return null;
  }

  if (economy && game.combat) {
    const paid = await economy.spend(actor, coatingCost(actor), { source: game.i18n.localize('E20.PoisonCoatTitle') });
    if (paid.blocked) {
      return null;
    }
  }

  const poison = actor.items.get(poisonId);
  const dif = CONFIG.E20.availabilityDifficulties?.[poison.system.availability] ?? 0;
  await actor._dice?.rollSkill({
    skill: 'science', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: String(dif),
    riderSpec: JSON.stringify({ kind: 'coat', poisonId, weaponId }),
  }, actor);
  return null;
}

/**
 * Table 3-1: what the Science Skill Test did.
 * @param {Actor} actor
 * @param {{poisonId: String, weaponId: String}} spec
 * @param {{success: Boolean, isCrit: Boolean, isFumble: Boolean}} outcome
 * @returns {Promise<String>}   The chat line.
 */
export async function resolveCoatingRoll(actor, spec, { success, isCrit, isFumble }) {
  const poison = actor.items.get(spec.poisonId);
  const weapon = actor.items.get(spec.weaponId);
  if (!poison || !weapon) {
    return '';
  }

  if (success) {
    const effect = effectsOf(actor, poison).find(e => e.system?.damageValue) ?? effectsOf(actor, poison)[0];
    await weapon.setFlag('essence20', COATING_FLAG, {
      name: poison.name,
      damageValue: effect?.system?.damageValue ?? 0,
      damageType: effect?.system?.damageType ?? 'poison',
      hacker: isHackerPoison(poison),
    });
  }

  const usesVial = (success && !isCrit) || (isFumble && !ruleKeepsVialOnFumble(actor));
  if (usesVial) {
    await useVial(poison);
  }

  const key = success ? (isCrit ? 'E20.PoisonCoatCrit' : 'E20.PoisonCoatSuccess') : (isFumble ? 'E20.PoisonCoatFumble' : 'E20.PoisonCoatFail');
  return game.i18n.format(key, { name: actor.name, poison: poison.name, weapon: weapon.name });
}

async function useVial(poison) {
  const remaining = (poison.system.quantity ?? 1) - 1;
  if (remaining > 0) {
    await poison.update({ 'system.quantity': remaining });
  } else {
    await poison.delete();
  }
}

/**
 * The attack with a coated weapon happened - the poison is gone either way.
 * @param {Item} weapon
 */
export async function wipeCoating(weapon) {
  // A venomous pet's bite carries its poison for good (Cobra Codex p.103: "loses the Consumable trait").
  if (coatingOf(weapon) && !coatingOf(weapon).permanent) {
    await weapon.unsetFlag('essence20', COATING_FLAG);
  }
}
