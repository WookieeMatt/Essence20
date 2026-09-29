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
 * explosives instead of ballistic. The one Limited melee weapon qualification is per-weapon, which
 * the actor's qualification map (by weapon type) can't hold - it stays the player's note.
 */

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

  await actor.update(officerTrainingUpdate());
  await item.setFlag('essence20', 'd21OfficerApplied', true);
  return T('D21OfficerApplied', { name: escape(actor.name) });
}

registerUse({
  id: 'd21AlternateOfficer',
  matches: item => sourceOf(item) == D21.alternateOfficer,
  canUse: item => !item?.flags?.essence20?.d21OfficerApplied,
  run: item => useAlternateOfficer(item),
});
