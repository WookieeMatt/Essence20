import { registerSceneAdvanced } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

/**
 * Bestow Expertise (MLP CRB p.137) lasts the scene: the Specializations it gave (./bestow-expertise.mjs) go when
 * the GM starts a new one.
 */

registerSceneAdvanced(async () => {
  for (const actor of worldActors()) {
    const bestowed = actor.flags?.essence20?.bestowedExpertise ?? [];
    if (!bestowed.length) {
      continue;
    }

    const updates = { 'flags.essence20.bestowedExpertise': [] };
    for (const { skill, key } of bestowed) {
      updates[`system.skills.${skill}.specializations.${key}`] = new foundry.data.operators.ForcedDeletion();
    }

    await actor.update(updates);
  }
});
