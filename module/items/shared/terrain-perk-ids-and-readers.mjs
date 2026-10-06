/**
 * Shared by the Perks and upgrades that only work in a particular environment or terrain (Item Review,
 * "situational" group, slice 1): their compendium ids and the environment readers. They read the physical
 * environment (mechanics/world/environment.mjs#getEnvironment - underwater, zero-G...) or the terrain/biome
 * (getTerrain - arctic, urban, woodlands...) the GM set on the Scene or on an Environment Region, and fall back to a
 * player toggle when the GM hasn't tagged the scene - the same split mechanics/world/environmental-expertise.mjs
 * already uses.
 *
 * (The environment readers these Perks once shared went with their code; their rules read the scene with terrain: /
 * environment: tags.)
 *
 * (Misguide's ROUGH_TERRAIN_IMPOSERS entry and Weather Gear / Acclimating's ENVIRONMENT_PROTECTORS are item rules now -
 * RoughTerrainImposer / HazardProtection, rules/plugins/combat/hazard-terrain-targets.mjs.)
 */

// (Urban Adaptation and Izuna Drop are their items' own rules - rules/conv14-items2.test.js; Adapted Vehicles and
// Environmental Enforcer too - rules/conv15-items2.test.js.)
export const S1 = {
};
// Jungle Fighter and Out of the Jungle are item rules (rules/conv5-slC5.test.js, rules/conv8-slC8.test.js),
// and so are Earth Defense Command Benefits' Driving ↑2 (rules/conv8-slC8.test.js) and Space Kit (its Use rule). Layered Armor, Environmental Warrior, Fast
// Tracking and Contort are item rules too (rules/conv10-slC10.test.js). Jungle Fighter's light armor counting as
// Silent is item rules too (rules/conv8-slC8.test.js), Weatherproof is item rules now (host-scoped RollModifiers on
// the upgrade, rules/conv3-slC3.test.js), and so is City Slicker's Streetwise switch (terrain:urban, pre-ticked when
// urban). Danger Sense (GI Joe CRB, Bodyguard, 6th level, p.110): the holder's own immunity and its Protected Target's
// within 10 ft are ConditionImmunity rules on the item (the second an aura with holder:protects -
// rules/conv10-slD10.test.js). Ambush Master's extra attack is an item rule now (rules/conv6-slC6.test.js).
// Spacewalker's Evasion and Environmental Camouflage are item rules now; mechanics/world/position-rules-refresh.mjs's
// updateToken hook refreshes any actor whose rules read where its token stands.
