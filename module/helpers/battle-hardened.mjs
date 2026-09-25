import { actorHasPerk } from "./perks.mjs";

/**
 * Battle Hardened (GI Joe CRB, General Perk, p.130, Level 12): "When you spend a Story Point,
 * roll a d4. On a 4, regain the spent Story Point." Distinct from the same-named TF CRB/GI Joe
 * CRB ROLE Perks (a plain +1 Health Active Effect, already built) - name-collision confirmed by
 * reading both compendium items directly before starting, the same "same name, different Perk"
 * trap this project has hit before (Not Done Yet/Not Dead Yet).
 *
 * Story Points are a world-scoped Foundry Setting only a GM can write (see story-points.mjs's own
 * doc comment) - a spend is relayed over a fire-and-forget socket message from whichever player's
 * client requested it to whichever GM client is connected, which only ever carried a display-only
 * actorName string, no resolvable actor reference. Widened requestStoryPointSpend's own payload
 * with an actorUuid field (the function already has the real actor in scope, so this needed no
 * caller-site changes anywhere) so handleStoryPointSpendRequest can resolve the spending actor via
 * fromUuid and check whether they hold this Perk, after the spend itself is already committed -
 * this is the FIRST hook of any kind into the Story Point spend flow itself, unlocking the exact
 * same infra for Person Of Culture (General Hawk's Personnel Files, p.174 - "When you spend a
 * Story Point to get a hint, roll a Culture Skill Test; on success, you don't spend it" - a real,
 * player-facing Skill Test rather than a flat d4, so it needs its own confirm-roll UI on top of
 * this same hook, not attempted this pass).
 */
export const BATTLE_HARDENED_ID = "Compendium.essence20.gi_joe_crb.Item.fbmfn6iNGjlm3voE";

// Battle-Hardened (Decepticon Directive, General Perk, p.65, Level 12): "When you spend a Story
// Point, roll a d4. On a 4, your team regains the spent Story Point." Word for word the same
// mechanism as the GI Joe CRB Perk above (down to the identical prerequisite) - "your team"
// regaining the point is no different from the base grant, since both spend from the one shared
// pool a Player Character draws on (story-points.mjs#poolFor) - so it joins the same check rather
// than a second copy of rollBattleHardenedRefund.
const BATTLE_HARDENED_DD_ID = "Compendium.essence20.decepticon_directive.Item.iA8J97GmKb51oumg";

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function actorHasBattleHardened(actor) {
  return actorHasPerk(actor, BATTLE_HARDENED_ID) || actorHasPerk(actor, BATTLE_HARDENED_DD_ID);
}

/**
 * Rolls the flat d4 RAW itself describes.
 * @returns {Promise<Boolean>}   True on a 4 (refund the spent point).
 */
export async function rollBattleHardenedRefund() {
  const roll = await new Roll('1d4').evaluate();
  return roll.total == 4;
}
