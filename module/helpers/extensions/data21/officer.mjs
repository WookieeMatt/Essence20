import { registerUse } from "../../extensions.mjs";
import { D21, T, escape, sourceOf } from "./common.mjs";

/**
 * Alternate Officer Equipment Training and Qualifications (Sgt Slaughter Sourcebook, p.9): "When you
 * create a new Officer character, at 1st level you can choose to permanently replace the Role's
 * default Alternate Equipment Training and Qualifications with the following ... Battledress: You
 * are trained in Light Armor. Weapons: You are trained in melee weapons and explosives, and
 * Qualified in a Limited Melee Weapon of your choice."
 *
 * The Use button rewrites the actor's training (system.trained.*, what the Officer Role set when it
 * was added): Light armor only; melee (Finesse, Might melee, Blunt, close-combat heavy blades) and
 * explosives instead of ballistic. It then asks for the Limited melee weapon: a copy is added marked
 * Qualified ("access ... without requisitioning it", as the qualify2 Perks do), the choice is kept on
 * the item (flag d21OfficerWeapon), and Requisition counts that weapon as Qualified.
 */

export const OFFICER_WEAPON_FLAG = 'd21OfficerWeapon';

const effectsOfEntry = entry => Object.values(entry?.system?.items ?? {}).filter(effect => effect?.type == 'weaponEffect');

/** A compendium weapon entry that is melee. */
export function isMeleeWeaponEntry(entry) {
  return effectsOfEntry(entry).some(effect => effect.classification?.style == 'melee' || effect.range?.reachMultiplier > 0);
}

/** Whether this weapon is the Limited melee weapon an Alternate Officer chose. */
export function isOfficerWeapon(actor, item) {
  const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
  const officer = items.find(candidate => sourceOf(candidate) == D21.alternateOfficer);
  const chosen = officer?.flags?.essence20?.[OFFICER_WEAPON_FLAG];
  if (!chosen || item?.type != 'weapon') {
    return false;
  }

  const source = sourceOf(item) ?? item.uuid;
  return chosen.uuid == source || chosen.uuid == item.uuid || String(chosen.name ?? '').toLowerCase() == String(item.name ?? '').toLowerCase();
}

/** Requisition: the chosen weapon is Qualified. */
export function onOfficerRequisitionAccess(actor, item, out) {
  if (isOfficerWeapon(actor, item)) {
    out.access = 'qualified';
  }
}

async function chooseOfficerWeapon(item) {
  const { findItems, grantCopy, pickOne } = await import("../../grants.mjs");
  const rows = await findItems({ type: 'weapon', availabilities: ['limited'], matches: isMeleeWeaponEntry });
  const uuid = await pickOne(item.name, rows);
  if (!uuid) {
    return null;
  }

  const copy = await grantCopy(item.parent, uuid, { grantedBy: item, flags: { qualified: true } });
  const chosen = { uuid, name: copy?.name ?? rows.find(row => row.uuid == uuid)?.name ?? '' };
  await item.setFlag('essence20', OFFICER_WEAPON_FLAG, chosen);
  return chosen;
}

export const OFFICER_TRAINING = {
  armors: { light: true, medium: false },
  weapons: { ballistic: false, blunt: true, closeCombatHeavyBlade: true, explosives: true, finesse: true, mightMelee: true },
};

export function officerTrainingUpdate() {
  const update = {};
  for (const [type, value] of Object.entries(OFFICER_TRAINING.armors)) {
    update[`system.trained.armors.${type}`] = value;
  }

  for (const [type, value] of Object.entries(OFFICER_TRAINING.weapons)) {
    update[`system.trained.weapons.${type}`] = value;
  }

  return update;
}

export async function useAlternateOfficer(item) {
  const actor = item?.parent;
  if (!actor) {
    return null;
  }

  // A second press (no weapon picked the first time) only picks the weapon.
  if (!item.flags?.essence20?.d21OfficerApplied) {
    await actor.update(officerTrainingUpdate());
    await item.setFlag('essence20', 'd21OfficerApplied', true);
  }

  const weapon = await chooseOfficerWeapon(item);
  return weapon
    ? T('D21OfficerAppliedWeapon', { name: escape(actor.name), weapon: escape(weapon.name) })
    : T('D21OfficerApplied', { name: escape(actor.name) });
}

registerUse({
  id: 'd21AlternateOfficer',
  matches: item => sourceOf(item) == D21.alternateOfficer,
  canUse: item => !item?.flags?.essence20?.d21OfficerApplied || !item?.flags?.essence20?.[OFFICER_WEAPON_FLAG],
  run: item => useAlternateOfficer(item),
});

if (globalThis.Hooks?.on) {
  Hooks.on('essence20.requisitionAccess', onOfficerRequisitionAccess);
}
