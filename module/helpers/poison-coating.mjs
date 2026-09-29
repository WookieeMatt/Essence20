import { isMechanical } from "./creature-tags.mjs";

/**
 * Poisons put on weapons, and changing what a poison is (Cobra Codex, p.92-97).
 *
 * "Contact poisons can be applied to a weapon or one round of ammunition as a Standard action. Make
 * a Science Skill Test against the Availability DIF of the poison you're attempting to apply"
 * (p.93, Table 3-1): a Critical Success applies it without using the vial up, a success applies it
 * and uses the vial, a failure does nothing, a Fumble wastes the vial. "If you successfully applied
 * the poison to the weapon or ammunition, your next attack with that weapon, if successful, deals
 * not just one of the weapon's normal effects, but also the effect of the applied poison."
 *
 * The coating is a flag on the weapon holding the poison's effect, so the vial can be used up and
 * the coating still knows what it does. The next attack with the weapon wipes it; a hit also offers
 * the poison's effect as a second button on the card (target-riders.mjs#applyRollRiders).
 *
 * - Poisonous (Commando Poisoner, p.49): "You can apply a contact poison to a weapon as a Move
 *   action." Intoxicate (10th level, p.50): "as a Free action."
 * - Poison Tipped (3rd level, p.49): "you no longer consume a dose of poison when you fumble
 *   applying it to a weapon or ammunition."
 * - Poison Chemistry (6th level, p.49): "As a Standard action, you can change the state of a poison
 *   (contact, ingested, or inhaled) you have in your hand."
 * - Poison Prodigy (20th level, p.50): "As a Standard action, you can change the type of a poison
 *   you have in your hand to any other, including poisons of harder availability. As a Move action,
 *   you can add a weapon upgrade to a poison as long as it meets the prerequisites."
 * - Hacker (General Perk, p.80): "your poisons affect only robots and targets with the Computerized
 *   Trait... for each poison you requisition, you choose whether it's a typical poison or a hacker
 *   poison." A hacker poison is marked on the poison itself.
 */

const CC = id => `Compendium.essence20.cobra_codex.Item.${id}`;
export const POISON_PERK = {
  poisonous: CC('9kQxCeLIm10zB1h7'),
  intoxicate: CC('uoNrrDfkqk5pKnwC'),
  poisonTipped: CC('Kgcm0HoMe5wuVfuv'),
  poisonChemistry: CC('MOOrbfVEyGTDExfv'),
  poisonProdigy: CC('qkvDR7I1tBwOyStY'),
  hacker: CC('s56rG7h3is1WNpz2'),
};

const COATING_FLAG = 'poisonCoating';
export const HACKER_POISON_FLAG = 'hackerPoison';

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
}

function has(actor, uuid) {
  return !!actor?.items?.some?.(item => sourceOf(item) == uuid);
}

export function poisonsOf(actor) {
  return (actor?.items?.contents ?? [...(actor?.items ?? [])]).filter(item => item.type == 'weapon' && item.system?.isPoison);
}

function effectsOf(actor, weapon) {
  return (actor?.items?.contents ?? [...(actor?.items ?? [])])
    .filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id);
}

/**
 * What applying a contact poison costs this actor.
 */
export function coatingCost(actor) {
  if (has(actor, POISON_PERK.intoxicate)) {
    return 'free';
  }

  return has(actor, POISON_PERK.poisonous) ? 'move' : 'standard';
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
 * @param {Object} economy   helpers/action-economy.mjs, passed in to keep this file free of it.
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

  const usesVial = (success && !isCrit) || (isFumble && !has(actor, POISON_PERK.poisonTipped));
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

/**
 * Poison Chemistry: change a poison's state.
 * @param {Actor} actor
 * @returns {Promise<String|null>}
 */
export async function changePoisonState(actor, economy) {
  const poisons = poisonsOf(actor);
  const poisonId = await pick(game.i18n.localize('E20.PoisonChemistryTitle'), game.i18n.localize('E20.PoisonCoatPickPoison'),
    poisons.map(p => ({ value: p.id, label: p.name })));
  if (!poisonId) {
    return null;
  }

  const state = await pick(game.i18n.localize('E20.PoisonChemistryTitle'), game.i18n.localize('E20.PoisonChemistryPickState'),
    Object.entries(CONFIG.E20.poisonApplications).map(([value, label]) => ({ value, label: game.i18n.localize(label) })));
  if (!state) {
    return null;
  }

  if (economy && game.combat) {
    const paid = await economy.spend(actor, 'standard', { source: game.i18n.localize('E20.PoisonChemistryTitle') });
    if (paid.blocked) {
      return null;
    }
  }

  const poison = actor.items.get(poisonId);
  await poison.update({
    'system.poisonApplication': Object.fromEntries(Object.keys(CONFIG.E20.poisonApplications).map(key => [key, key == state])),
  });
  return game.i18n.format('E20.PoisonChemistryDone', {
    name: actor.name, poison: poison.name, state: game.i18n.localize(CONFIG.E20.poisonApplications[state]),
  });
}

/**
 * Poison Prodigy: swap a poison for another from the compendiums, or (as a Move action) add an
 * upgrade to it - the upgrade is dropped onto the poison the usual way, so this only charges the
 * action.
 * @param {Actor} actor
 * @returns {Promise<String|null>}
 */
export async function poisonProdigy(actor, economy) {
  const mode = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.PoisonProdigyTitle') },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.localize('E20.PoisonProdigyPrompt')}</p>`,
    buttons: [
      { action: 'type', label: game.i18n.localize('E20.PoisonProdigyChangeType') },
      { action: 'upgrade', label: game.i18n.localize('E20.PoisonProdigyAddUpgrade') },
    ],
    rejectClose: false,
  });
  if (!mode) {
    return null;
  }

  if (mode == 'upgrade') {
    if (economy && game.combat) {
      const paid = await economy.spend(actor, 'move', { source: game.i18n.localize('E20.PoisonProdigyTitle') });
      if (paid.blocked) {
        return null;
      }
    }

    return game.i18n.format('E20.PoisonProdigyUpgradeReady', { name: actor.name });
  }

  const held = poisonsOf(actor);
  const poisonId = await pick(game.i18n.localize('E20.PoisonProdigyTitle'), game.i18n.localize('E20.PoisonCoatPickPoison'),
    held.map(p => ({ value: p.id, label: p.name })));
  if (!poisonId) {
    return null;
  }

  const candidates = [];
  for (const pack of game.packs ?? []) {
    if (pack.metadata?.type != 'Item' || pack.metadata?.packageName != 'essence20') {
      continue;
    }

    const index = await pack.getIndex({ fields: ['system.isPoison'] });
    for (const entry of index) {
      if (entry.type == 'weapon' && entry.system?.isPoison) {
        candidates.push({ value: entry.uuid, label: entry.name });
      }
    }
  }

  const uuid = await pick(game.i18n.localize('E20.PoisonProdigyTitle'), game.i18n.localize('E20.PoisonProdigyPickNew'),
    candidates.sort((a, b) => a.label.localeCompare(b.label)));
  if (!uuid) {
    return null;
  }

  if (economy && game.combat) {
    const paid = await economy.spend(actor, 'standard', { source: game.i18n.localize('E20.PoisonProdigyTitle') });
    if (paid.blocked) {
      return null;
    }
  }

  const old = actor.items.get(poisonId);
  const replacement = await fromUuid(uuid);
  if (!replacement) {
    return null;
  }

  // Dropped through the sheet's own weapon handling so the new poison's effects come too.
  const data = replacement.toObject();
  data.system.quantity = 1;
  const { onDropItem } = await import("../sheet-handlers/drop-handler.mjs");
  await onDropItem({ type: 'Item', uuid }, actor, async () => actor.createEmbeddedDocuments('Item', [data]));

  await useVial(old);
  return game.i18n.format('E20.PoisonProdigyChanged', { name: actor.name, from: old.name, to: replacement.name });
}

/**
 * Hacker: mark a poison as a hacker poison (or back).
 * @param {Actor} actor
 * @returns {Promise<String|null>}
 */
export async function toggleHackerPoison(actor) {
  const poisons = poisonsOf(actor);
  const poisonId = await pick(game.i18n.localize('E20.HackerPoisonTitle'), game.i18n.localize('E20.PoisonCoatPickPoison'),
    poisons.map(p => ({ value: p.id, label: `${p.name}${isHackerPoison(p) ? ` (${game.i18n.localize('E20.HackerPoisonMarked')})` : ''}` })));
  if (!poisonId) {
    return null;
  }

  const poison = actor.items.get(poisonId);
  const now = !isHackerPoison(poison);
  await poison.setFlag('essence20', HACKER_POISON_FLAG, now);
  return game.i18n.format(now ? 'E20.HackerPoisonOn' : 'E20.HackerPoisonOff', { name: actor.name, poison: poison.name });
}
