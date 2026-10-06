import { registerPreRoll, registerRollSources, registerUse } from "../../mechanics/item-hooks.mjs";
import { isRobotic } from "../../mechanics/characters/creature-tags.mjs";
import { CC, T, itemsOf, parentWeapon, sourceOf } from "../shared/power-pay-safe-writes.mjs";

/**
 * Cobra Codex gear and Perks: Electromagnetic attacks against computerized gear, the Deflecting
 * Weapon upgrades. (Shield Fighter, Onslaught, Poison Resistance, Dielectric, Insulator and
 * the Disenfranchised Hang-Up's Willpower check are item rules.)
 */
export const O1_CC = {
  limitedDeflecting: CC('KFoF9nEHJrRaJzZA'),
  standardDeflecting: CC('Z1OIoelOdyUdtyl7'),
  cyberneticPart: CC('wCL3rJOEDZVHVg6g'),
  enhancedPart: CC('eT4g9EfrFtvjMqWu'),
  optimizedPart: CC('zGsTAngJ2HRdKPkz'),
};

/** An upgrade counts while it is loose on the actor or on something equipped. */
export function isWorn(upgrade) {
  const parentId = upgrade?.flags?.essence20?.parentId;
  return !parentId || !!upgrade.parent?.items?.get?.(parentId)?.system?.equipped;
}

/* -------------------------------------------- */
/*  Electromagnetic vs computerized gear         */
/* -------------------------------------------- */

/**
 * GI Joe CRB p.207: Electromagnetic effects "are ↑3 against computers, computerized vehicles,
 * characters with computerized equipment, and robots, but ↓3 against all other targets." dice.mjs
 * reads only the Computerized vehicle trait, so a character in computerized gear or with cybernetic
 * parts (or a robot) was getting the ↓3.
 */
export function hasComputerizedGear(actor) {
  if (isRobotic(actor)) {
    return true;
  }

  return itemsOf(actor).some(item => {
    if ([O1_CC.cyberneticPart, O1_CC.enhancedPart, O1_CC.optimizedPart].includes(sourceOf(item))) {
      return true;
    }

    const traits = item.system?.traits ?? [];
    if (!traits.includes?.('computerized')) {
      return false;
    }

    return item.type == 'upgrade' ? isWorn(item) : (item.system?.equipped ?? true);
  });
}

// Dielectric / Insulator (the ↑3 cut to ↑1 / ↑2) are incoming item rules on their pack items.
function isElectromagneticAttack(actor, item) {
  return item?.type == 'weaponEffect'
    && (item.system?.damageType == 'emp' || !!parentWeapon(actor, item)?.system?.traits?.includes?.('electromagnetic'));
}

registerRollSources((actor, target, ctx) => {
  const item = ctx?.item;
  if (!target || !isElectromagneticAttack(actor, item)) {
    return null;
  }

  const label = game.i18n.localize('E20.DamageEmp');
  const sources = [];
  if (!target.system?.traits?.computerized && hasComputerizedGear(target)) {
    // Undo dice.mjs's "all other targets" ↓3, then the real ↑.
    sources.push({ id: 'o1EmNotOther', label: T('O1EmComputerizedGear', { label }), shiftUp: 3 });
    sources.push({ id: 'o1EmVsGear', label: T('O1EmVsGear', { label }), shiftUp: 3 });
  }

  return { sources };
});

/* -------------------------------------------- */
/*  Deflecting Weapon                            */
/* -------------------------------------------- */

// Standard/Limited Deflecting Weapon (Cobra Codex, weapon upgrades, p.97): "Choose a Standard
// [Limited] shield (page 98). When wielding a weapon with a... Deflecting Weapon upgrade, the
// weapon counts as both the upgraded weapon and the chosen shield. You cannot attack with the
// weapon when you're actively using it as a shield." The chosen shield is granted as a linked
// shield item that is equipped exactly while the weapon is; attacking with the weapon while that
// shield is raised is refused with a warning.
const DEFLECT = { [O1_CC.standardDeflecting]: 'standard', [O1_CC.limitedDeflecting]: 'limited' };

export function linkedShield(actor, weaponId) {
  return itemsOf(actor).find(item => item.type == 'shield' && item.flags?.essence20?.o1DeflectingWeapon == weaponId) ?? null;
}

async function grantDeflectingShield(upgrade) {
  const actor = upgrade.parent;
  const weapon = actor?.items?.get?.(upgrade.flags?.essence20?.parentId);
  const availability = DEFLECT[sourceOf(upgrade)];
  if (!weapon || !availability || linkedShield(actor, weapon.id)) {
    return null;
  }

  const { findItems, grantCopy, pickOne } = await import("../../mechanics/resources/grants.mjs");
  const uuid = await pickOne(upgrade.name, await findItems({ type: 'shield', availabilities: [availability] }));
  const source = uuid ? await fromUuid(uuid) : null;
  if (!source) {
    return null;
  }

  return grantCopy(actor, uuid, {
    grantedBy: upgrade,
    name: T('O1DeflectingName', { weapon: weapon.name, shield: source.name }),
    flags: { o1DeflectingWeapon: weapon.id, o1DeflectingUpgrade: upgrade.id },
    system: { equipped: !!weapon.system?.equipped, active: false },
  });
}

Hooks.on('createItem', async (item, options, userId) => {
  if (userId == game.user?.id && item.type == 'upgrade' && DEFLECT[sourceOf(item)] && item.flags?.essence20?.parentId) {
    await grantDeflectingShield(item);
  }
});

registerUse({
  id: 'o1DeflectingWeapon',
  matches: item => !!DEFLECT[sourceOf(item)],
  canUse: item => !!item.flags?.essence20?.parentId && !linkedShield(item.parent, item.flags.essence20.parentId),
  run: async (item) => ((await grantDeflectingShield(item)) ? T('O1DeflectingGranted', { name: item.parent.name }) : null),
});

// The shield is only in hand while the weapon is.
Hooks.on('updateItem', async (item, changes, options, userId) => {
  const equipped = foundry.utils.getProperty(changes, 'system.equipped');
  if (userId != game.user?.id || item.type != 'weapon' || equipped === undefined) {
    return;
  }

  const shield = linkedShield(item.parent, item.id);
  if (!shield || shield.system.equipped == equipped) {
    return;
  }

  if (!equipped && shield.system.active) {
    const update = {};
    for (const defense of Object.keys(CONFIG.E20?.defenses ?? {})) {
      update[`system.defenses.${defense}.shield`] = 0;
    }

    await item.parent.update(update);
  }

  await shield.update({ 'system.equipped': equipped, ...(equipped ? {} : { 'system.active': false }) });
});

Hooks.on('deleteItem', async (item, options, userId) => {
  if (userId != game.user?.id || !item.parent) {
    return;
  }

  const weaponId = item.type == 'weapon' ? item.id : (DEFLECT[sourceOf(item)] ? item.flags?.essence20?.parentId : null);
  const shield = weaponId ? linkedShield(item.parent, weaponId) : null;
  if (shield) {
    await shield.delete();
  }
});

registerPreRoll(async (actor, dataset, item) => {
  const weapon = parentWeapon(actor, item);
  const shield = weapon ? linkedShield(actor, weapon.id) : null;
  if (shield?.system?.active) {
    ui.notifications?.warn?.(T('O1DeflectingRaised', { weapon: weapon.name }));
  }
});

// Shield Fighter (the Element Use and its hit option) and Onslaught (the other effects as hit options) are rules on
// their pack items (rules/plugins/combat/hit-rider.mjs).

/* -------------------------------------------- */
/*  Disenfranchised                              */
/* -------------------------------------------- */

// Disenfranchised (Cobra Codex, Influence Hang-Up, p.30) is its own Use rule: it posts a button any helper presses
// to roll Deception, Intimidation or Persuasion (as their selected token, else their character) against this
// character's Willpower.
