import { registerChatButton, registerRoundStart } from "../../mechanics/item-hooks.mjs";
import { deps } from "../shared/situation-checks.mjs";
import { situationalInitiative, takeInASceneButton, misplacedConfidenceRound } from "./situational-initiative.mjs";

/**
 * Situational items (Item Review "situational" group, slice 2) - rules that only apply in a place
 * (a town, the wild, the sea, a library, complete darkness), against someone (a StrexCorp agent, a
 * creature that attacked you, an ally who out-rolled you), or at the start of a fight (Surprise).
 * This wires the Initiative-time ones (Take in a Scene, Misplaced Confidence - ./situational-initiative.mjs) and
 * fills ../shared/situation-checks.mjs's readers at init; Competitive is ./competitive.mjs and the Region-change
 * refresh mechanics/world/position-rules-refresh.mjs.
 *
 * Where the scene can answer (the GM-set terrain/environment - mechanics/world/environment.mjs - the scene's
 * darkness level, a target's name or creature tags), the rule applies by itself as a labelled roll
 * source. Where it can't, the Roll Options Dialog offers a checkbox instead, so a table that never
 * tags its scenes still gets the rule.
 *
 * Item rules now (rules/conv5-slC5.test.js): Seafarer's swimming Edge, the Seafarer Hang-Up's poison
 * Edge against its holder, Tritium Sights, Feet Wet (and Ship Shape's Feet Wet half), Shark's Fin's
 * Movement, and Amphibious Assault's / Tracking Outfit's Initiative halves. Ship Shape's vehicle
 * Movement too (rules/conv6-slC6.test.js). Caltrops and Bookworm's Initiative half too (rules/conv7-slC7.test.js).
 * Forgiving, and Plow's Rough Terrain after a Ram, too (rules/conv8-slC8.test.js). The Seafarer Hang-Up's Snag on
 * resisting poison, the exposure clothes (Arctic / Desert Expedition Clothes, Desert Gear) and Business too
 * (rules/conv10-slC10.test.js).
 *
 * Ship Shape's Movement x1.5 for the aquatic vehicle its holder drives is an item rule (rules/conv6-slC6.test.js).
 * Cartography Suite's Move actions while Surprised are SurpriseExemption rules on the Perk (self and a 60 ft ally
 * aura), Plow's Multiple Targets a MultipleTargets rule, Lay of the Land's Rough Terrain a MovementAction rule and
 * Cartography Suite's survey a Use rule on the Perk (rules/conv10-slE10.test.js).
 */

/**
 * Loads the heavier helpers and joins the patched-in hook arrays: rough-terrain.mjs
 * ROUGH_TERRAIN_IGNORERS (situational1's patch), multiple-targets.mjs MULTIPLE_TARGETS_GRANTS and
 * dice.mjs INITIATIVE_EXTENSIONS (SCRATCH/integration/situational2-patch.cjs). Absent arrays are
 * skipped, so nothing breaks before the patches run.
 */
export async function loadDeps() {
  const environment = await import("../../mechanics/world/environment.mjs");
  deps.getTerrain = actor => environment.getTerrain(actor);
  deps.getEnvironment = actor => environment.getEnvironment(actor, { includeInterior: false });
  const clock = await import("../../mechanics/resources/scene-clock.mjs");
  deps.getSceneEpoch = clock.getSceneEpoch;
  const allies = await import("../../mechanics/combat/nearby-allies.mjs");
  deps.nearbyAllies = allies.getNearbyAllyTokens;

  const dice = await import("../../dice.mjs");
  dice.INITIATIVE_EXTENSIONS?.push(situationalInitiative);
}

registerRoundStart(misplacedConfidenceRound);
registerChatButton('s2TakeInScene', takeInASceneButton);

if (typeof Hooks != 'undefined') {
  Hooks.once?.('init', () => {
    loadDeps().catch(error => console.error('Essence20 | situational2 setup failed', error));
  });
}
