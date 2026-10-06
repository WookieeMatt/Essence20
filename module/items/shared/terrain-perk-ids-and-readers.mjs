/**
 * Shared by the Perks and upgrades that only work in a particular environment or terrain (Item Review,
 * "situational" group, slice 1): their compendium ids and the environment readers. They read the physical
 * environment (mechanics/world/environment.mjs#getEnvironment - underwater, zero-G...) or the terrain/biome
 * (getTerrain - arctic, urban, woodlands...) the GM set on the Scene or on an Environment Region, and fall back to a
 * player toggle when the GM hasn't tagged the scene - the same split mechanics/world/environmental-expertise.mjs
 * already uses.
 *
 * The heavy modules (environment, environmental-expertise) are loaded at setup with dynamic import - see `deps`
 * below - so none of these files joins an import cycle.
 *
 * (Misguide's ROUGH_TERRAIN_IMPOSERS entry and Weather Gear / Acclimating's ENVIRONMENT_PROTECTORS are item rules now -
 * RoughTerrainImposer / HazardProtection, rules/plugins/combat/hazard-terrain-targets.mjs.)
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const S1 = {
  urbanAdaptation: uuid('cobra_codex', 'zdCIZOr6JOPGKUmL'),
  urbanJungle: uuid('cobra_codex', 'wIesQd7U5W2azAWY'),
  earthDefenseCommand: uuid('field_guide_action_adventure', 'uQQbRbwADVtVwsym'),
  adaptedVehicle: uuid('gi_joe_crb', 'ht26M90320SgdhMK'),
  environmentalExpertise: uuid('gi_joe_crb', 'EbbSUA2vSHyv3MjQ'),
  izunaDrop: uuid('intercontinental_adventures', 'jaUwQUvv1rXlXQUA'),
  environmentalEnforcer: uuid('general_hawk_s_personel_files', 'eZuijWvAUzOXD8DR'),
};
// Jungle Fighter and Out of the Jungle are item rules (rules/conv5-slC5.test.js, rules/conv8-slC8.test.js),
// and so is Earth Defense Command Benefits' Driving ↑2 (rules/conv8-slC8.test.js). Layered Armor, Environmental Warrior, Fast
// Tracking and Contort are item rules too (rules/conv10-slC10.test.js). Jungle Fighter's light armor counting as
// Silent is item rules too (rules/conv8-slC8.test.js), Weatherproof is item rules now (host-scoped RollModifiers on
// the upgrade, rules/conv3-slC3.test.js), and so is City Slicker's Streetwise switch (terrain:urban, pre-ticked when
// urban). Danger Sense (GI Joe CRB, Bodyguard, 6th level, p.110): the holder's own immunity and its Protected Target's
// within 10 ft are ConditionImmunity rules on the item (the second an aura with holder:protects -
// rules/conv10-slD10.test.js). Ambush Master's extra attack is an item rule now (rules/conv6-slC6.test.js).
// Spacewalker's Evasion and Environmental Camouflage are item rules now; mechanics/world/position-rules-refresh.mjs's
// updateToken hook refreshes any actor whose rules read where its token stands.

export const isAttackItem = item => item?.type == 'weaponEffect';

/**
 * Environment readers, filled in at setup by loadTerrainReaders() from the heavy modules. The defaults mean
 * "nothing known" so a roll made before they load, or in a unit test, simply gets no bonus.
 */
export const deps = {
  getEnvironment: () => 'normal',
  getTerrain: () => null,
  isInEnvironmentOfExpertise: () => null,
  isEnvironmentalExpertiseActive: () => false,
};

export function terrainOf(actor) {
  try {
    return deps.getTerrain(actor) || null;
  } catch (error) {
    return null;
  }
}

export async function loadTerrainReaders() {
  const environment = await import("../../mechanics/world/environment.mjs");
  deps.getEnvironment = (actor, options) => environment.getEnvironment(actor, options);
  deps.getTerrain = actor => environment.getTerrain(actor);
  const expertise = await import("../../mechanics/world/environmental-expertise.mjs");
  deps.isInEnvironmentOfExpertise = (actor, terrain) => expertise.isInEnvironmentOfExpertise(actor, ...(terrain === undefined ? [] : [terrain]));
  deps.isEnvironmentalExpertiseActive = expertise.isEnvironmentalExpertiseActive;
}

/**
 * Joins the patched-in rough-terrain.mjs ROUGH_TERRAIN_IGNORERS array (SCRATCH/integration/situational1-patch.cjs) at
 * setup. Absent until the patch runs.
 */
export function ignoreRoughTerrainWhen(checkFn) {
  if (typeof Hooks != 'undefined') {
    Hooks.once('setup', () => {
      import("../../mechanics/world/rough-terrain.mjs")
        .then(rough => rough.ROUGH_TERRAIN_IGNORERS?.push({ checkFn }))
        .catch(error => console.error('Essence20 | situational1 deps failed', error));
    });
  }
}

if (typeof Hooks != 'undefined') {
  Hooks.once('setup', () => {
    loadTerrainReaders().catch(error => console.error('Essence20 | situational1 deps failed', error));
  });
}
