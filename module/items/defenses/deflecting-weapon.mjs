import { registerPreRoll, registerUse } from "../../mechanics/item-hooks.mjs";
import { CC, parentWeapon } from "../shared/pay-power-and-actors-in-play.mjs";
import { T } from "../shared/item-lang.mjs";
import { itemsOf, sourceOf } from "../shared/item-lookups.mjs";

/**
 * Standard/Limited Deflecting Weapon (Cobra Codex, weapon upgrades, p.97): "Choose a Standard
 * [Limited] shield (page 98). When wielding a weapon with a... Deflecting Weapon upgrade, the
 * weapon counts as both the upgraded weapon and the chosen shield. You cannot attack with the
 * weapon when you're actively using it as a shield." The chosen shield is granted as a linked
 * shield item that is equipped exactly while the weapon is; attacking with the weapon while that
 * shield is raised is refused with a warning.
 */
export const DEFLECTING_IDS = {
  limitedDeflecting: CC('KFoF9nEHJrRaJzZA'),
  standardDeflecting: CC('Z1OIoelOdyUdtyl7'),
};

const DEFLECT = { [DEFLECTING_IDS.standardDeflecting]: 'standard', [DEFLECTING_IDS.limitedDeflecting]: 'limited' };

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
// their pack items (rules/plugins/combat/hit-rider.mjs). Disenfranchised (Cobra Codex, Influence Hang-Up, p.30) is
// its own Use rule: it posts a button any helper presses to roll Deception, Intimidation or Persuasion (as their
// selected token, else their character) against this character's Willpower.
